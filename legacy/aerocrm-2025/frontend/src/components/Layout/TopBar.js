import React from 'react';
import { AppBar, Toolbar, IconButton, Typography, Badge, Box, Tooltip, Avatar, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountCircle from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useSelector, useDispatch } from 'react-redux';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { logoutUser } from '../../store/slices/authSlice';
import { fetchUnreadCount } from '../../store/slices/notificationSlice'; // Assuming you have this

const TopBar = ({ drawerWidth, handleDrawerToggle }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const { unreadCount } = useSelector(state => state.notifications);
    const [anchorEl, setAnchorEl] = useState(null);

    React.useEffect(() => {
        // Fetch unread count periodically or on specific events
        dispatch(fetchUnreadCount());
        const interval = setInterval(() => {
            dispatch(fetchUnreadCount());
        }, 60000); // Fetch every 60 seconds
        return () => clearInterval(interval);
    }, [dispatch]);


    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        dispatch(logoutUser());
        handleClose();
        navigate('/login');
    };

    const handleProfile = () => {
         navigate('/profile');
         handleClose();
    };

     const handleNotifications = () => {
          navigate('/notifications');
     };

    return (
        <AppBar
            position="fixed"
            sx={{
                width: { sm: `calc(100% - ${drawerWidth}px)` },
                ml: { sm: `${drawerWidth}px` },
                backgroundColor: 'background.paper', // Use theme background
                color: 'text.primary', // Use theme text color
                boxShadow: 'none',
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`
            }}
        >
            <Toolbar>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={handleDrawerToggle}
                    sx={{ mr: 2, display: { sm: 'none' } }}
                >
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                    AeroCRM
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                     <Tooltip title="Уведомления">
                        <IconButton
                            size="large"
                            aria-label="show new notifications"
                            color="inherit"
                            onClick={handleNotifications}
                        >
                            <Badge badgeContent={unreadCount} color="error">
                                <NotificationsIcon />
                            </Badge>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={user?.full_name || user?.email || 'Профиль'}>
                        <IconButton
                            size="large"
                            edge="end"
                            aria-label="account of current user"
                            aria-controls="menu-appbar"
                            aria-haspopup="true"
                            onClick={handleMenu}
                            color="inherit"
                        >
                             {user?.profile_picture_url ? (
                                <Avatar src={user.profile_picture_url} sx={{ width: 32, height: 32 }} />
                             ) : (
                                <AccountCircle />
                             )}
                        </IconButton>
                    </Tooltip>
                    <Menu
                        id="menu-appbar"
                        anchorEl={anchorEl}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                    >
                        <MenuItem onClick={handleProfile}>
                             <AccountCircle sx={{ mr: 1 }} /> Профиль
                         </MenuItem>
                        <MenuItem onClick={handleLogout}>
                            <LogoutIcon sx={{ mr: 1 }} /> Выход
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;



