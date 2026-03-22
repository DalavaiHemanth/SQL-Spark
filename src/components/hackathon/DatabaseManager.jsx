
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Upload, Database, Check, Globe, Lock, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const MAX_STORAGE_SIZE_MB = 50;
const MAX_DATA_SIZE = 850 * 1024;
const MIN_ROWS_PER_TABLE = 10;

const DatabaseManager = ({
    onSelect,
    selectedUrl,
    onLargeFileExtract,
    SQL,
    filterTeamId = null,
    showOnlyOwn = false,
    showOnlyPublic = false,
    onAddToHackathon = null,
    hackathonDbIds = [],
}) => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractProgress, setExtractProgress] = useState(0);
    // Pre-upload dialog state
    const [pendingFile, setPendingFile] = useState(null); // file staged for upload
    const [dbName, setDbName] = useState('');
    const [makePublic, setMakePublic] = useState(false);

    // Fetch Library — own databases + public ones from others
    const { data: library = [], isLoading } = useQuery({
        queryKey: ['database_library', user?.id],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) return [];
            const { data, error } = await supabase
                .from('database_library')
                .select('*')
                .or(`uploaded_by.eq.${userId},is_public.eq.true`)
                .order('created_at', { ascending: false });
            if (error) throw error;
            // Apply client-side filters based on props
            if (showOnlyOwn) return data.filter(d => d.uploaded_by === userId);
            if (showOnlyPublic) return data.filter(d => d.is_public);
            return data;
        },
        enabled: !!user
    });

    // Toggle visibility mutation
    const toggleVisibility = useMutation({
        mutationFn: async ({ id, is_public }) => {
            const { error } = await supabase
                .from('database_library')
                .update({ is_public })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: (_, { is_public }) => {
            queryClient.invalidateQueries(['database_library']);
            toast.success(is_public ? 'Database is now public' : 'Database is now private');
        },
        onError: (err) => toast.error(`Failed: ${err.message}`)
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('database_library')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['database_library']);
            toast.success('Database removed from library');
        },
        onError: (err) => toast.error(`Delete failed: ${err.message}`)
    });

    // Upload Mutation
    const uploadMutation = useMutation({
        mutationFn: async ({ file, isPublic, name }) => {
            const fileName = `library/${Date.now()}_${file.name}`;
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/hackathon-assets/${fileName}`);
                xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
                xhr.setRequestHeader('x-upsert', 'true');
                xhr.setRequestHeader('Content-Type', 'application/x-sqlite3');
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
                };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else {
                        let errMsg = 'Upload failed';
                        try { const d = JSON.parse(xhr.responseText); errMsg = d.message || d.error || errMsg; } catch { errMsg = xhr.responseText || errMsg; }
                        reject(new Error(errMsg));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(file);
            });

            const result = supabase.storage.from('hackathon-assets').getPublicUrl(fileName);
            const publicUrl = result.data.publicUrl;

            const { data, error } = await supabase
                .from('database_library')
                .insert({ name: name || file.name, file_url: publicUrl, uploaded_by: session.user.id, is_public: isPublic })
                .select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries(['database_library']);
            toast.success(`Database uploaded (${data.is_public ? 'public' : 'private'})!`);
            setIsUploading(false);
            setUploadProgress(0);
            if (onSelect) onSelect(data.file_url);
        },
        onError: (err) => {
            toast.error(`Upload failed: ${err.message}`);
            setIsUploading(false);
            setUploadProgress(0);
        }
    });

    // Extract large file locally
    const extractLargeFile = async (file) => {
        if (!SQL) { toast.error('SQL engine not loaded yet.'); return; }
        setIsExtracting(true);
        setExtractProgress(0);
        try {
            setExtractProgress(5);
            const buffer = await file.arrayBuffer();
            setExtractProgress(10);
            const database = new SQL.Database(new Uint8Array(buffer));
            setExtractProgress(15);
            const tablesResult = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
            let schemaSQL = '';
            if (tablesResult.length > 0) schemaSQL = tablesResult[0].values.map(r => r[0] + ';').join('\n\n');
            setExtractProgress(20);
            if (!schemaSQL) { toast.error('No tables found.'); database.close(); return; }

            const tableNames = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
            const totalTables = tableNames[0]?.values?.length || 0;
            const tableCounts = [];
            let grandTotalRows = 0;
            for (let i = 0; i < totalTables; i++) {
                const name = tableNames[0].values[i][0];
                const c = database.exec(`SELECT COUNT(*) FROM "${name}"`);
                const count = c.length > 0 ? c[0].values[0][0] : 0;
                tableCounts.push({ name, totalRows: count });
                grandTotalRows += count;
                setExtractProgress(Math.round(20 + ((i + 1) / totalTables) * 15));
            }

            let dataSQL = '', totalRowsExtracted = 0, wasTruncated = false;
            const tableStats = [];
            const needsSampling = grandTotalRows * 100 > MAX_DATA_SIZE;
            for (let i = 0; i < totalTables; i++) {
                const { name: tableName, totalRows } = tableCounts[i];
                let rowLimit = totalRows;
                if (needsSampling) {
                    const budget = Math.floor((MAX_DATA_SIZE / 100) * (totalRows / grandTotalRows));
                    rowLimit = Math.max(MIN_ROWS_PER_TABLE, Math.min(totalRows, budget));
                }
                const rows = database.exec(`SELECT * FROM "${tableName}" LIMIT ${rowLimit}`);
                let tableRowCount = 0;
                if (rows.length > 0 && rows[0].values.length > 0) {
                    const cols = rows[0].columns.map(c => `"${c}"`).join(', ');
                    for (const vals of rows[0].values) {
                        const escaped = vals.map(v => v === null ? 'NULL' : typeof v === 'number' ? v : "'" + String(v).replace(/'/g, "''") + "'").join(', ');
                        const line = `INSERT INTO "${tableName}" (${cols}) VALUES (${escaped});\n`;
                        if (dataSQL.length + line.length > MAX_DATA_SIZE) { wasTruncated = true; break; }
                        dataSQL += line; tableRowCount++; totalRowsExtracted++;
                    }
                    dataSQL += '\n';
                }
                if (tableRowCount < totalRows) wasTruncated = true;
                tableStats.push({ name: tableName, extracted: tableRowCount, total: totalRows, truncated: tableRowCount < totalRows });
                setExtractProgress(Math.round(35 + ((i + 1) / totalTables) * 55));
                await new Promise(r => setTimeout(r, 0));
                if (dataSQL.length >= MAX_DATA_SIZE) break;
            }
            database.close();
            setExtractProgress(95);
            if (onLargeFileExtract) await onLargeFileExtract(schemaSQL, dataSQL, tableStats);
            setExtractProgress(100);
            const sizeKB = (dataSQL.length / 1024).toFixed(0);
            if (wasTruncated) {
                const report = tableStats.filter(t => t.truncated).map(t => `• ${t.name}: ${t.extracted}/${t.total} rows`).join('\n');
                toast.warning(`Extracted ${totalTables} table(s), ${totalRowsExtracted} rows (${sizeKB}KB) — sampled:\n${report}`, { duration: 12000 });
            } else {
                toast.success(`Extracted ${totalTables} table(s), ${totalRowsExtracted} rows (${sizeKB}KB)!`, { duration: 6000 });
            }
        } catch (err) {
            console.error('Extract failed:', err);
            toast.error(`Failed: ${err.message}`);
        } finally { setIsExtracting(false); setExtractProgress(0); }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.match(/\.(db|sqlite|sqlite3)$/i)) { toast.error('Only .db or .sqlite files allowed'); return; }
        // Stage the file — show dialog for name + visibility
        setPendingFile(file);
        setDbName(file.name.replace(/\.(db|sqlite|sqlite3)$/i, ''));
        setMakePublic(false);
        e.target.value = '';
    };

    const handleConfirmUpload = async () => {
        if (!pendingFile) return;
        const file = pendingFile;
        const isPublic = makePublic;
        const name = dbName.trim() || file.name;
        setPendingFile(null);

        if (file.size <= MAX_STORAGE_SIZE_MB * 1024 * 1024) {
            setIsUploading(true);
            uploadMutation.mutate({ file, isPublic, name });
        } else {
            toast.info(`File is ${(file.size / 1024 / 1024).toFixed(0)}MB — extracting locally...`, { duration: 5000 });
            await extractLargeFile(file);
        }
    };

    const isProcessing = isUploading || isExtracting;
    const isOwner = (db) => db.uploaded_by === user?.id;

    return (
        <div className="space-y-5">

            {/* Pre-upload dialog overlay */}
            {pendingFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                    <Database className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">Add Database</h3>
                                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{pendingFile.name}</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-5">
                            {/* Name input */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Database Name</label>
                                <input
                                    type="text"
                                    value={dbName}
                                    onChange={(e) => setDbName(e.target.value)}
                                    placeholder="e.g. E-commerce Sample"
                                    className="w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    style={{ background: '#1e293b', border: '1px solid #334155' }}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmUpload()}
                                />
                            </div>

                            {/* Visibility toggle */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Visibility</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setMakePublic(false)}
                                        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                                        style={{
                                            background: !makePublic ? '#1e3a2f' : '#1e293b',
                                            border: !makePublic ? '1.5px solid #10b981' : '1.5px solid #334155',
                                            color: !makePublic ? '#34d399' : '#94a3b8'
                                        }}
                                    >
                                        <Lock className="w-4 h-4" />
                                        <div className="text-left">
                                            <div className="font-semibold">Private</div>
                                            <div className="text-xs opacity-70">Only you</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setMakePublic(true)}
                                        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                                        style={{
                                            background: makePublic ? '#1e2d4a' : '#1e293b',
                                            border: makePublic ? '1.5px solid #3b82f6' : '1.5px solid #334155',
                                            color: makePublic ? '#60a5fa' : '#94a3b8'
                                        }}
                                    >
                                        <Globe className="w-4 h-4" />
                                        <div className="text-left">
                                            <div className="font-semibold">Public</div>
                                            <div className="text-xs opacity-70">All admins</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setPendingFile(null)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition"
                                style={{ background: '#1e293b', border: '1px solid #334155' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmUpload}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload toolbar — just the button */}
            <div className="flex items-center justify-end">
                <div className="relative">
                    <input
                        type="file" id="db-upload" className="hidden"
                        accept=".db,.sqlite,.sqlite3"
                        onChange={handleFileChange}
                        disabled={isProcessing}
                    />
                    <label
                        htmlFor="db-upload"
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5'}`}
                        style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white' }}
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isUploading ? `Uploading ${uploadProgress}%` : isExtracting ? `Extracting ${extractProgress}%` : 'Upload Database'}
                    </label>
                </div>
            </div>

            {/* Progress bars */}
            {(isExtracting || isUploading) && (
                <div className="space-y-1.5">
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                                width: `${isExtracting ? extractProgress : uploadProgress}%`,
                                background: 'linear-gradient(90deg, #059669, #34d399)'
                            }}
                        />
                    </div>
                    {isExtracting && (
                        <p className="text-xs text-emerald-400 font-medium">
                            {extractProgress < 10 ? 'Reading file...' :
                             extractProgress < 20 ? 'Extracting schema...' :
                             extractProgress < 35 ? 'Counting rows...' :
                             extractProgress < 90 ? 'Extracting data...' :
                             extractProgress < 100 ? 'Saving...' : 'Done!'}
                        </p>
                    )}
                </div>
            )}

            {/* Database grid */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            ) : library.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-600"
                    style={{ background: '#1e293b' }}>
                    <Database className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No databases yet</p>
                    <p className="text-sm text-slate-500 mt-1">Upload a .db file to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {library.map((db) => {
                        const selected = selectedUrl === db.file_url;
                        const owned = isOwner(db);
                        return (
                            <div
                                key={db.id}
                                onClick={() => onSelect && onSelect(db.file_url)}
                                className="group relative rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                                style={{
                                    background: selected ? '#0f2a1f' : '#1e293b',
                                    border: selected
                                        ? '1.5px solid #10b981'
                                        : '1.5px solid #334155',
                                    boxShadow: selected
                                        ? '0 0 12px rgba(16,185,129,0.15)'
                                        : '0 2px 6px rgba(0,0,0,0.3)'
                                }}
                            >
                                {/* Selected indicator */}
                                {selected && (
                                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                                        <Check className="w-3.5 h-3.5 text-white" />
                                    </div>
                                )}

                                {/* Icon + name */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 rounded-lg" style={{
                                        background: selected ? '#134e33' : '#334155'
                                    }}>
                                        <Database className={`w-4 h-4 ${selected ? 'text-emerald-400' : 'text-slate-400'}`} />
                                    </div>
                                    <h4 className="font-semibold text-slate-200 truncate flex-1 text-sm" title={db.name}>
                                        {db.name}
                                    </h4>
                                </div>

                                {/* Footer: date + badges + actions */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>{new Date(db.created_at).toLocaleDateString()}</span>
                                        {!owned && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-blue-400/80 bg-blue-500/10">
                                                <Globe className="w-2.5 h-2.5" /> shared
                                            </span>
                                        )}
                                    </div>

                                    {/* Owner actions */}
                                    {owned && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleVisibility.mutate({ id: db.id, is_public: !db.is_public });
                                                }}
                                                className="p-1.5 rounded-lg transition-colors hover:bg-slate-700/50"
                                                title={db.is_public ? 'Make private' : 'Make public'}
                                            >
                                                {db.is_public
                                                    ? <Globe className="w-3.5 h-3.5 text-blue-400" />
                                                    : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Remove this database from the library?')) {
                                                        deleteMutation.mutate(db.id);
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Add to Hackathon button */}
                                    {onAddToHackathon && (() => {
                                        const alreadyAdded = hackathonDbIds.includes(db.id);
                                        return (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!alreadyAdded) onAddToHackathon(db);
                                                }}
                                                className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                    alreadyAdded
                                                        ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                                                        : 'bg-violet-600 hover:bg-violet-500 text-white'
                                                }`}
                                                title={alreadyAdded ? 'Already in hackathon' : 'Add to hackathon database list'}
                                            >
                                                {alreadyAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                {alreadyAdded ? 'Added' : 'Add'}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-xs text-slate-500/70 text-center">
                Files ≤50MB upload directly • Larger files auto-extract as SQL
            </p>
        </div>
    );
};

export default DatabaseManager;
