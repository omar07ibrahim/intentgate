import React from 'react';
import { Drawer, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Toolbar } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';

import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import EventNoteIcon from '@mui/icons-material/EventNote';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import GroupIcon from '@mui/icons-material/Group';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AssignmentIcon from '@mui/icons-material/Assignment';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import PolicyIcon from '@mui/icons-material/Policy';

const navLinkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '8px 16px',
    color: isActive ? '#1976d2' : 'inherit', // Example active color
    backgroundColor: isActive ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
    textDecoration: 'none',
    borderRadius: '4px', // Optional
    '&:hover': {
        backgroundColor: 'rgba(0, 0, 0, 0.04)', // Subtle hover effect
    },
});

const SideBar = ({ drawerWidth, mobileOpen, handleDrawerToggle }) => {
    const { isStaff } = useSelector(state => state.auth);

    const drawerContent = (
        <div>
            <Toolbar /> {/* Spacer to align content below TopBar */}
            <Divider />
            <List>
                {/* Common Menu Items */}
                <ListItem disablePadding>
                    <NavLink to="/" style={navLinkStyle} onClick={handleDrawerToggle}>
                        <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                            <DashboardIcon />
                        </ListItemIcon>
                        <ListItemText primary="Панель управления" />
                    </NavLink>
                </ListItem>
                 <ListItem disablePadding>
                    <NavLink to="/profile" style={navLinkStyle} onClick={handleDrawerToggle}>
                        <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                            <PersonIcon />
                        </ListItemIcon>
                        <ListItemText primary="Мой профиль" />
                    </NavLink>
                 </ListItem>
                <ListItem disablePadding>
                     <NavLink to="/documents/general" style={navLinkStyle} onClick={handleDrawerToggle}>
                         <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                             <DescriptionIcon />
                         </ListItemIcon>
                         <ListItemText primary="Общие документы" />
                     </NavLink>
                 </ListItem>
                  <ListItem disablePadding>
                     <NavLink to="/documents/personal" style={navLinkStyle} onClick={handleDrawerToggle}>
                         <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                             <FolderSharedIcon />
                         </ListItemIcon>
                         <ListItemText primary="Личные документы" />
                     </NavLink>
                  </ListItem>
                 <ListItem disablePadding>
                     <NavLink to="/leaves/history" style={navLinkStyle} onClick={handleDrawerToggle}>
                         <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                             <EventNoteIcon />
                         </ListItemIcon>
                         <ListItemText primary="Отпуска/Отсутствия" />
                     </NavLink>
                  </ListItem>
                 <ListItem disablePadding>
                     <NavLink to="/notifications" style={navLinkStyle} onClick={handleDrawerToggle}>
                         <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                             <NotificationsIcon />
                         </ListItemIcon>
                         <ListItemText primary="Уведомления" />
                     </NavLink>
                  </ListItem>
            </List>
            <Divider />

            {/* Admin Menu Items */}
            {isStaff && (
                <>
                    <List subheader={<ListItemText primary="Администрирование" sx={{ pl: 2, pt: 1, color: 'text.secondary' }} />}>
                        <ListItem disablePadding>
                            <NavLink to="/admin/users" style={navLinkStyle} onClick={handleDrawerToggle}>
                                <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                                    <GroupIcon />
                                </ListItemIcon>
                                <ListItemText primary="Пользователи" />
                            </NavLink>
                        </ListItem>
                         <ListItem disablePadding>
                            <NavLink to="/admin/roles" style={navLinkStyle} onClick={handleDrawerToggle}>
                                <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                                    <VpnKeyIcon />
                                </ListItemIcon>
                                <ListItemText primary="Роли" />
                            </NavLink>
                        </ListItem>
                         <ListItem disablePadding>
                            <NavLink to="/admin/document-types" style={navLinkStyle} onClick={handleDrawerToggle}>
                                <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                                    <AssignmentIcon />
                                </ListItemIcon>
                                <ListItemText primary="Типы документов" />
                            </NavLink>
                        </ListItem>
                         <ListItem disablePadding>
                            <NavLink to="/admin/documents/upload" style={navLinkStyle} onClick={handleDrawerToggle}>
                                <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                                    <UploadFileIcon />
                                </ListItemIcon>
                                <ListItemText primary="Загрузить документ" />
                            </NavLink>
                        </ListItem>
                         <ListItem disablePadding>
                             <NavLink to="/admin/leaves/manage" style={navLinkStyle} onClick={handleDrawerToggle}>
                                 <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                                     <EventBusyIcon />
                                 </ListItemIcon>
                                 <ListItemText primary="Упр. отсутствиями" />
                             </NavLink>
                         </ListItem>
                         <ListItem disablePadding>
                             <NavLink to="/admin/audit-log" style={navLinkStyle} onClick={handleDrawerToggle}>
                                 <ListItemIcon sx={{ color: 'inherit', minWidth: '40px' }}>
                                     <PolicyIcon />
                                 </ListItemIcon>
                                 <ListItemText primary="Журнал аудита" />
                             </NavLink>
                         </ListItem>
                    </List>
                     <Divider />
                 </>
            )}
        </div>
    );

    return (
        <Box
            component="nav"
            sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
            aria-label="mailbox folders"
        >
            {/* Temporary Drawer for Mobile */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{
                    keepMounted: true, // Better open performance on mobile.
                }}
                sx={{
                    display: { xs: 'block', sm: 'none' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: 'none' }, // Remove border for temp drawer
                }}
            >
                {drawerContent}
            </Drawer>
            {/* Permanent Drawer for Desktop */}
            <Drawer
                variant="permanent"
                sx={{
                    display: { xs: 'none', sm: 'block' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: (theme) => `1px solid ${theme.palette.divider}` },
                }}
                open
            >
                {drawerContent}
            </Drawer>
        </Box>
    );
};

export default SideBar;



