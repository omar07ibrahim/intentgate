import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { Container, Paper, Typography, List, ListItem, ListItemText, ListItemIcon, IconButton, Box, CircularProgress, Button, Divider, Chip, Tooltip } from '@mui/material';
import { format } from 'date-fns';
import PageTitle from '../components/Common/PageTitle';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import notificationService from '../services/notificationService';
import { fetchUnreadCount } from '../store/slices/notificationSlice'; // Import thunk

import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArticleIcon from '@mui/icons-material/Article'; // For related docs
import EventBusyIcon from '@mui/icons-material/EventBusy'; // For related leaves etc.

const NotificationsPage = () => {
    const queryClient = useQueryClient();
    const dispatch = useDispatch();
    const [filterRead, setFilterRead] = useState(null); // null = all, true = read, false = unread

    // Initial fetch + count fetch
    const { data, error, isLoading, isFetching } = useQuery(
        ['notifications', filterRead], // Include filter in query key
        () => notificationService.getNotifications({ read: filterRead }),
        { keepPreviousData: true }
    );

    const { data: unreadData } = useQuery('unreadCount', notificationService.getUnreadCount);


    const markReadMutation = useMutation(notificationService.markAsRead, {
        onSuccess: (updatedNotification) => {
             // Optimistically update the specific notification
             queryClient.setQueryData(['notifications', filterRead], (oldData) => {
                 if (!oldData) return oldData;
                  const updatedResults = oldData.results?.map(n =>
                      n.id === updatedNotification.id ? updatedNotification : n
                  ) ?? [];
                  return { ...oldData, results: updatedResults };
             });
             // Refetch the unread count
             dispatch(fetchUnreadCount());
        },
        onError: (error) => {
             toast.error(`Ошибка отметки: ${error.response?.data?.detail || error.message}`);
        },
    });

    const markAllReadMutation = useMutation(notificationService.markAllAsRead, {
        onSuccess: () => {
             toast.success('Все уведомления отмечены как прочитанные.');
             // Refetch everything
             queryClient.invalidateQueries('notifications');
             dispatch(fetchUnreadCount());
        },
        onError: (error) => {
             toast.error(`Ошибка: ${error.response?.data?.detail || error.message}`);
        },
    });

    const deleteMutation = useMutation(notificationService.deleteNotification, {
        onSuccess: (_, deletedId) => {
            toast.success('Уведомление удалено.');
             // Optimistically remove from cache
             queryClient.setQueryData(['notifications', filterRead], (oldData) => {
                  if (!oldData) return oldData;
                  const updatedResults = oldData.results?.filter(n => n.id !== deletedId) ?? [];
                  return { ...oldData, results: updatedResults, count: (oldData.count ?? 1) - 1 };
             });
             dispatch(fetchUnreadCount()); // Update count
        },
        onError: (error) => {
             toast.error(`Ошибка удаления: ${error.response?.data?.detail || error.message}`);
        },
    });


    const handleMarkRead = (id) => {
        markReadMutation.mutate(id);
    };

    const handleMarkAllRead = () => {
        markAllReadMutation.mutate();
    };

    const handleDelete = (id) => {
         if (window.confirm('Удалить это уведомление?')) {
             deleteMutation.mutate(id);
         }
    };

    const getLevelIcon = (level) => {
        switch(level) {
            case 'INFO': return <InfoIcon color="info" />;
            case 'SUCCESS': return <CheckCircleIcon color="success" />;
            case 'WARNING': return <WarningIcon color="warning" />;
            case 'ERROR': return <ErrorIcon color="error" />;
            default: return <InfoIcon color="action" />;
        }
    };

     const getRelatedObjectIcon = (info) => {
         if (!info) return null;
         switch(info.type) {
             case 'document': return <ArticleIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle' }} />;
             case 'personaldocument': return <ArticleIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle' }} />;
             case 'leaverecord': return <EventBusyIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle' }} />;
             // Add more cases as needed
             default: return null;
         }
     };

    const notifications = data?.results || [];
    const unreadCount = unreadData?.unread_count ?? 0;

    return (
        <Container maxWidth="md">
            <PageTitle title="Мои уведомления" subtitle={`${unreadCount} непрочитанных`}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant={filterRead === null ? "contained" : "outlined"} onClick={() => setFilterRead(null)}>Все</Button>
                        <Button size="small" variant={filterRead === false ? "contained" : "outlined"} onClick={() => setFilterRead(false)}>Непрочитанные</Button>
                        <Button size="small" variant={filterRead === true ? "contained" : "outlined"} onClick={() => setFilterRead(true)}>Прочитанные</Button>
                    </Box>
                     <Button
                         variant="outlined"
                         size="small"
                         onClick={handleMarkAllRead}
                         disabled={unreadCount === 0 || markAllReadMutation.isLoading}
                         startIcon={markAllReadMutation.isLoading ? <CircularProgress size={16}/> : <MarkEmailReadIcon />}
                     >
                         Отметить все как прочитанные
                     </Button>
                 </Box>
            </PageTitle>


            {isLoading && <LoadingSpinner />}
            {error && <Typography color="error">Ошибка загрузки уведомлений: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ mt: 2 }}>
                    <List disablePadding>
                        {notifications.map((n, index) => (
                            <React.Fragment key={n.id}>
                                <ListItem
                                    alignItems="flex-start"
                                    secondaryAction={
                                        <>
                                            {!n.is_read && (
                                                <Tooltip title="Отметить как прочитанное">
                                                    <IconButton edge="end" aria-label="mark read" onClick={() => handleMarkRead(n.id)} disabled={markReadMutation.isLoading}>
                                                        <MarkEmailUnreadIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Удалить">
                                                <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(n.id)} disabled={deleteMutation.isLoading}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </>
                                    }
                                    sx={{ backgroundColor: n.is_read ? 'transparent' : 'action.hover' }}
                                >
                                    <ListItemIcon sx={{ mt: 0.5, minWidth: 40 }}>{getLevelIcon(n.level)}</ListItemIcon>
                                    <ListItemText
                                        primary={
                                             <Typography variant="subtitle1" component="span" fontWeight={n.is_read ? 'normal' : 'bold'}>
                                                  {n.title}
                                                  {getRelatedObjectIcon(n.related_object_info)}
                                             </Typography>
                                        }
                                        secondary={
                                            <>
                                                <Typography
                                                    sx={{ display: 'block' }}
                                                    component="span"
                                                    variant="body2"
                                                    color="text.primary"
                                                >
                                                    {n.message}
                                                </Typography>
                                                 <Typography component="span" variant="caption" color="text.secondary">
                                                     {format(new Date(n.created_at), 'dd.MM.yyyy HH:mm')}
                                                      {n.is_read && n.read_at ? ` (Прочитано: ${format(new Date(n.read_at), 'dd.MM.yy HH:mm')})` : ''}
                                                 </Typography>

                                            </>
                                        }
                                    />
                                </ListItem>
                                {index < notifications.length - 1 && <Divider variant="inset" component="li" />}
                             </React.Fragment>
                        ))}
                        {notifications.length === 0 && (
                            <ListItem>
                                <ListItemText primary="Уведомлений нет." sx={{ textAlign: 'center', color: 'text.secondary' }} />
                            </ListItem>
                        )}
                    </List>
                    {/* Add pagination if needed, though usually notifications are not heavily paginated */}
                 </Paper>
            )}
            {isFetching && !isLoading && <CircularProgress sx={{ position: 'absolute', top: '70px', right: '20px' }} size={25}/>}
        </Container>
    );
};

export default NotificationsPage;


