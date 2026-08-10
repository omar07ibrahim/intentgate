import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import TopBar from './TopBar';
import SideBar from './SideBar';

const drawerWidth = 240;

const Layout = () => {
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <TopBar drawerWidth={drawerWidth} handleDrawerToggle={handleDrawerToggle} />
            <SideBar drawerWidth={drawerWidth} mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    mt: '64px' // Adjust based on TopBar height
                }}
            >
                <Outlet /> {/* Child routes will render here */}
            </Box>
        </Box>
    );
};

export default Layout;


