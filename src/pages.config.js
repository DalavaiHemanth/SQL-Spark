/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminUsers from './pages/AdminUsers';
import AdminDashboard from './pages/AdminDashboard';
import AdminHackathon from './pages/AdminHackathon';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import HackathonResults from './pages/HackathonResults';
import JoinHackathon from './pages/JoinHackathon';
import Login from './pages/Login';
import TeamDashboard from './pages/TeamDashboard';
import Profile from './pages/Profile';
import GlobalLeaderboard from './pages/GlobalLeaderboard';

import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminUsers": AdminUsers,
    "AdminDashboard": AdminDashboard,
    "AdminHackathon": AdminHackathon,
    "Dashboard": Dashboard,
    "Home": Home,
    "HackathonResults": HackathonResults,
    "JoinHackathon": JoinHackathon,
    "Login": Login,
    "TeamDashboard": TeamDashboard,
    "Profile": Profile,
    "GlobalLeaderboard": GlobalLeaderboard,

}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};