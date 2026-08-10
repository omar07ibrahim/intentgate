import React from 'react';
import { useSelector } from 'react-redux';
import { Container, Grid, Paper, Typography, Box, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PageTitle from '../components/Common/PageTitle';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DescriptionIcon from '@mui/icons-material/Description';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FolderSharedIcon from '@mui/icons-material/FolderShared';

const DashboardPage = () => {
    const { user } = useSelector((state) => state.auth);
    const { unreadCount } = useSelector(state => state.notifications); // Get unread count

    // Fetch pending acknowledgments count, upcoming personal doc expiries, pending leave requests etc. here using react-query or useEffect

    return (
        <Container maxWidth="lg">
            <PageTitle title={`Добро пожаловать, ${user?.first_name || user?.email}!`} />

            <Grid container spacing={3}>
                {/* Quick Stats / Links */}
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                         <NotificationsIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                         <Typography variant="h6">{unreadCount}</Typography>
                         <Typography color="text.secondary">Новых уведомлений</Typography>
                         <Link component={RouterLink} to="/notifications" sx={{ mt: 1 }}>Перейти</Link>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                         <DescriptionIcon color="action" sx={{ fontSize: 40, mb: 1 }} />
                         <Typography variant="h6">N/A</Typography>
                         <Typography color="text.secondary">Документов на ознакомление</Typography>
                         <Link component={RouterLink} to="/documents/general?acknowledged=false" sx={{ mt: 1 }}>Перейти</Link>
                    </Paper>
                </Grid>
                 <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                         <FolderSharedIcon color="action" sx={{ fontSize: 40, mb: 1 }} />
                         <Typography variant="h6">N/A</Typography>
                         <Typography color="text.secondary">Документов скоро истекут</Typography>
                         <Link component={RouterLink} to="/documents/personal" sx={{ mt: 1 }}>Перейти</Link>
                    </Paper>
                </Grid>
                 <Grid item xs={12} sm={6} md={3}>
                     <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                         <EventNoteIcon color="action" sx={{ fontSize: 40, mb: 1 }} />
                         <Typography variant="h6">N/A</Typography>
                         <Typography color="text.secondary">Запросов на отсутствие</Typography>
                         <Link component={RouterLink} to="/leaves/history?status=REQUESTED" sx={{ mt: 1 }}>Перейти</Link>
                     </Paper>
                  </Grid>

                {/* Placeholder for other dashboard widgets */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Последние новости / Важная информация</Typography>
                        <Typography>Здесь может быть блок с важными объявлениями или последними загруженными документами.</Typography>
                        {/* Add more dashboard content here */}
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default DashboardPage;


