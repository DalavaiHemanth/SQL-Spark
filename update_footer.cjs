const fs = require('fs');
const content = fs.readFileSync('src/pages/Home.jsx', 'utf-8');
const lines = content.split(/\r?\n/);

const startIdx = lines.findIndex(l => l.includes('{/* Footer Section */}'));
const endIdx = lines.findIndex(l => l.includes('</footer>'));

if (startIdx !== -1 && endIdx !== -1) {
    const newFooter = `            {/* Ultra-Premium Footer Section */}
            <footer className="relative bg-[#020617] text-slate-400 py-24 border-t border-slate-800/80 overflow-hidden mt-auto">
                {/* Glowing Backgrounds */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

                <div className="relative max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-12 gap-16 items-center">
                        
                        {/* Brand Column */}
                        <div className="lg:col-span-5 relative z-10">
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="flex items-center gap-4 mb-8"
                            >
                                <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-md">
                                    <Sparkles className="w-8 h-8 text-emerald-400" />
                                </div>
                                <span className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400 tracking-tight">
                                    SQL Spark
                                </span>
                            </motion.div>
                            <motion.p 
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="text-lg text-slate-400 mb-10 leading-relaxed max-w-md font-medium"
                            >
                                Empowering developers to master databases through high-stakes, real-time SQL challenges. Built with precision and passion.
                            </motion.p>
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                                className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 font-semibold uppercase tracking-widest"
                            >
                                <span>&copy; {new Date().getFullYear()} SQL Spark</span>
                                <span className="hidden sm:inline border-l border-slate-800 h-4"></span>
                                <span className="flex items-center gap-1.5">
                                    Crafted with <Heart className="w-4 h-4 text-red-500/80 fill-red-500/20 animate-pulse" />
                                </span>
                            </motion.div>
                        </div>
                        
                        {/* Developer Profile Card */}
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, x: 20 }}
                            whileInView={{ opacity: 1, scale: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3, type: 'spring', bounce: 0.4 }}
                            className="lg:col-span-7 bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 p-8 md:p-12 rounded-[2rem] shadow-2xl relative overflow-hidden group z-10"
                        >
                            {/* Card Hover Glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition duration-700 ease-out pointer-events-none" />
                            <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition duration-700 pointer-events-none" />
                            
                            <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center justify-between mb-10 border-b border-slate-800/80 pb-10">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase shadow-inner">
                                        <Code2 className="w-4 h-4" />
                                        Platform Developer
                                    </div>
                                    <h3 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-2 tracking-tight">Dalavai Hemanth</h3>
                                    <p className="text-emerald-400 font-semibold flex items-center gap-2 text-lg">
                                        Full Stack Engineer
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <a href="mailto:hemanthleads@gmail.com" className="w-14 h-14 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
                                        <Mail className="w-6 h-6" />
                                    </a>
                                    <a href="https://linkedin.com/in/dalavai-hemanth-86638931b" target="_blank" rel="noreferrer" className="w-14 h-14 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(59,130,246,0.2)]">
                                        <Linkedin className="w-6 h-6" />
                                    </a>
                                </div>
                            </div>

                            <div className="relative grid sm:grid-cols-2 gap-6">
                                <div className="flex items-start gap-4 md:gap-5 p-5 md:p-6 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:bg-slate-900 transition-colors hover:border-violet-500/30 group/item">
                                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20 group-hover/item:scale-110 transition-transform duration-300 ease-out">
                                        <GraduationCap className="w-6 h-6 text-violet-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-widest mb-1.5">Department</p>
                                        <p className="text-slate-200 font-semibold text-base md:text-lg">Data Science</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 md:gap-5 p-5 md:p-6 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:bg-slate-900 transition-colors hover:border-blue-500/30 group/item">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 group-hover/item:scale-110 transition-transform duration-300 ease-out">
                                        <Building2 className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-widest mb-1.5">Institution</p>
                                        <p className="text-slate-200 font-semibold text-sm leading-snug">
                                            Rajeev Gandhi Memorial College of Engineering and Technology
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </div>
            </footer>`;

    lines.splice(startIdx, endIdx - startIdx + 1, newFooter);
    fs.writeFileSync('src/pages/Home.jsx', lines.join('\n'), 'utf-8');
    console.log('Success');
} else {
    console.log('Failed to find markers');
}
