import React from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import documentService from '../services/documentService';
import { Container, Paper, Typography, Box, Button, CircularProgress, Chip, Divider, Grid, List, ListItem, ListItemAvatar, Avatar, ListItemText, Alert } from '@mui/material';
import { format } from 'date-fns';
import PageTitle from '../components/Common/PageTitle';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PersonIcon from '@mui/icons-material/Person';
import { useSelector } from 'react-redux';

const DocDetailPage = () => {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const { user: currentUser } = useSelector(state => state.auth);

    const { data: document, error, isLoading, isError } = useQuery(
        ['generalDocumentDetail', id],
        () => documentService.getGeneralDocumentDetail(id)
    );

    const acknowledgeMutation = useMutation(() => documentService.acknowledgeDocument(id), {
        onSuccess: () => {
            toast.success('Ознакомление подтверждено!');
            queryClient.invalidateQueries(['generalDocumentDetail', id]);
            queryClient.invalidateQueries('generalDocuments'); // Invalidate list view as well
        },
        onError: (error) => {
            toast.error(`Ошибка подтверждения: ${error.response?.data?.detail || error.message}`);
        },
    });

    const handleAcknowledge = () => {
        acknowledgeMutation.mutate();
    };

    if (isLoading) return <LoadingSpinner />;
    if (isError) return <Container><Alert severity="error">Ошибка загрузки документа: {error.message}</Alert></Container>;
    if (!document) return <Container><Typography>Документ не найден.</Typography></Container>;

    const myAssignment = document.my_assignment; // Already included in detail serializer logic
    const assignments = document.assignees_summary || [];
    const stats = document.acknowledgment_stats || { total: 0, acknowledged: 0 };

    return (
        <Container maxWidth="lg">
            <PageTitle title={document.title} subtitle={`Тип: ${document.document_type?.name || 'Не указан'}`} />

            <Grid container spacing={3}>
                 <Grid item xs={12} md={8}>
                     <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Детали документа</Typography>
                         <Typography variant="body2" color="text.secondary" gutterBottom>
                             Загружен: {document.created_by?.full_name || 'N/A'} ({format(new Date(document.created_at), 'dd.MM.yyyy HH:mm')})
                         </Typography>
                         {document.acknowledgment_deadline && (
                             <Typography variant="body2" color={new Date(document.acknowledgment_deadline) < new Date() ? 'error' : 'text.secondary'} gutterBottom>
                                 Срок ознакомления: {format(new Date(document.acknowledgment_deadline), 'dd.MM.yyyy HH:mm')}
                             </Typography>
                         )}

                        <Divider sx={{ my: 2 }} />

                        {/* Placeholder for document preview or description */}
                         <Typography variant="body1" sx={{ mb: 2 }}>
                            {document.document_type?.description || 'Описание отсутствует.'}
                         </Typography>

                         {document.document_file_url && (
                             <Button
                                 variant="outlined"
                                 startIcon={<DownloadIcon />}
                                 href={document.document_file_url}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 sx={{ mb: 2 }}
                             >
                                 Скачать файл
                             </Button>
                         )}

                         <Divider sx={{ my: 2 }} />

                         <Box>
                            {myAssignment ? (
                                myAssignment.is_acknowledged ? (
                                     <Chip
                                        icon={<CheckCircleIcon />}
                                        label={`Вы ознакомлены ${format(new Date(myAssignment.acknowledged_at), 'dd.MM.yyyy HH:mm')}`}
                                        color="success"
                                        sx={{ p: 1, fontSize: '1rem' }}
                                     />
                                ) : (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Chip
                                            icon={<HourglassEmptyIcon />}
                                            label="Требуется ваше ознакомление"
                                            color="warning"
                                            sx={{ p: 1, fontSize: '1rem' }}
                                         />
                                        <Button
                                            variant="contained"
                                            onClick={handleAcknowledge}
                                            disabled={acknowledgeMutation.isLoading}
                                         >
                                             {acknowledgeMutation.isLoading ? <CircularProgress size={24} color="inherit"/> : 'Подтвердить ознакомление'}
                                         </Button>
                                     </Box>
                                )
                            ) : (
                                 <Typography color="text.secondary">Документ не требует вашего ознакомления напрямую.</Typography>
                            )}
                         </Box>

                     </Paper>
                 </Grid>

                 {/* Acknowledgment Status Panel (Visible to Admin or relevant roles) */}
                 {currentUser?.is_staff && (
                     <Grid item xs={12} md={4}>
                         <Paper sx={{ p: 2, height: '100%' }}>
                              <Typography variant="h6" gutterBottom>
                                 Статус ознакомления ({stats.acknowledged} / {stats.total})
                              </Typography>
                               <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                                   {assignments.map(assign => (
                                       <ListItem key={assign.user.id} disableGutters>
                                            <ListItemAvatar>
                                                <Avatar src={assign.user.profile_picture_url} sx={{ width: 32, height: 32}}>
                                                     {!assign.user.profile_picture_url && <PersonIcon fontSize="small"/>}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                               primary={assign.user.full_name}
                                               secondary={
                                                   assign.is_acknowledged
                                                    ? `Ознакомлен ${format(new Date(assign.acknowledged_at), 'dd.MM.yy HH:mm')}`
                                                    : 'Не ознакомлен'
                                               }
                                             />
                                              {assign.is_acknowledged ?
                                                <CheckCircleIcon color="success" fontSize="small"/> :
                                                <HourglassEmptyIcon color="disabled" fontSize="small"/>
                                              }
                                       </ListItem>
                                   ))}
                                   {assignments.length === 0 && <Typography variant="body2" color="text.secondary">Нет назначенных сотрудников.</Typography>}
                               </List>
                         </Paper>
                     </Grid>
                 )}
             </Grid>
        </Container>
    );
};

export default DocDetailPage;


