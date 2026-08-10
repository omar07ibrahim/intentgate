import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import documentService from '../services/documentService';
import { Container, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Button, Chip, Box, CircularProgress, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { format, differenceInDays, isPast } from 'date-fns';
import PageTitle from '../components/Common/PageTitle';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import PersonalDocForm from '../components/Documents/PersonalDocForm'; // Create this component

const PersonalDocsPage = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [openForm, setOpenForm] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null); // Document being edited
    const [deletingDocId, setDeletingDocId] = useState(null); // ID of doc to confirm deletion
    const queryClient = useQueryClient();

    const queryParams = {
        page: page + 1,
        page_size: rowsPerPage,
        ordering: 'expiry_date', // Sort by expiry date by default
    };

    const { data, error, isLoading, isFetching, refetch } = useQuery(
        ['personalDocuments', queryParams],
        () => documentService.getPersonalDocuments(queryParams),
        { keepPreviousData: true }
    );

    const deleteMutation = useMutation(documentService.deletePersonalDocument, {
        onSuccess: () => {
            toast.success('Личный документ удален.');
            setDeletingDocId(null);
            queryClient.invalidateQueries('personalDocuments');
        },
        onError: (error) => {
             toast.error(`Ошибка удаления: ${error.response?.data?.detail || error.message}`);
             setDeletingDocId(null);
        },
    });

    const handleOpenForm = (doc = null) => {
        setEditingDoc(doc);
        setOpenForm(true);
    };

    const handleCloseForm = () => {
        setOpenForm(false);
        setEditingDoc(null);
        // Refetch data after closing form (optional, could invalidate on success)
        // queryClient.invalidateQueries('personalDocuments');
    };

    const handleDeleteClick = (id) => {
        setDeletingDocId(id);
    };

    const handleDeleteConfirm = () => {
        if (deletingDocId) {
            deleteMutation.mutate(deletingDocId);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const getStatusChip = (doc) => {
        const today = new Date();
        const expiryDate = new Date(doc.expiry_date);
        const daysLeft = differenceInDays(expiryDate, today);

        if (isPast(expiryDate)) {
            return <Chip icon={<ErrorIcon />} label="Истёк срок" color="error" size="small" variant="outlined"/>;
        }
        if (daysLeft <= (doc.document_type?.expiry_tracking_days || 30)) { // Use threshold from type or default
            return <Chip icon={<WarningIcon />} label={`Истекает через ${daysLeft} дн.`} color="warning" size="small" variant="outlined"/>;
        }
        return <Chip icon={<CheckCircleIcon />} label="Действителен" color="success" size="small" variant="outlined"/>;
    };

    const documents = data?.results || [];
    const totalCount = data?.count || 0;

    return (
        <Container maxWidth="lg">
            <PageTitle title="Мои личные документы">
                 <Button
                     variant="contained"
                     startIcon={<AddCircleOutlineIcon />}
                     onClick={() => handleOpenForm()}
                 >
                     Добавить документ
                 </Button>
            </PageTitle>

            {isLoading && <LoadingSpinner />}
            {error && <Typography color="error">Ошибка загрузки документов: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader aria-label="personal documents table">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Тип документа</TableCell>
                                    <TableCell>Номер</TableCell>
                                    <TableCell>Дата выдачи</TableCell>
                                    <TableCell>Дата истечения</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell>Файл</TableCell>
                                    <TableCell>Действия</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {documents.map((doc) => (
                                    <TableRow hover key={doc.id}>
                                        <TableCell>{doc.document_type?.name || '-'}</TableCell>
                                        <TableCell>{doc.document_number || '-'}</TableCell>
                                        <TableCell>{doc.issue_date ? format(new Date(doc.issue_date), 'dd.MM.yyyy') : '-'}</TableCell>
                                        <TableCell>{format(new Date(doc.expiry_date), 'dd.MM.yyyy')}</TableCell>
                                        <TableCell>{getStatusChip(doc)}</TableCell>
                                         <TableCell>
                                             {doc.uploaded_file_url ? (
                                                 <IconButton href={doc.uploaded_file_url} target="_blank" rel="noopener noreferrer" size="small">
                                                     <DownloadIcon />
                                                 </IconButton>
                                             ) : '-'}
                                         </TableCell>
                                        <TableCell>
                                            <Tooltip title="Редактировать">
                                                <IconButton size="small" onClick={() => handleOpenForm(doc)}>
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Удалить">
                                                <IconButton size="small" onClick={() => handleDeleteClick(doc.id)} color="error">
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {documents.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">Личные документы не найдены. Нажмите "Добавить документ", чтобы загрузить.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25]}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage="Строк на странице:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} из ${count}`}
                    />
                </Paper>
            )}
             {isFetching && !isLoading && <CircularProgress sx={{ position: 'absolute', top: '70px', right: '20px' }} size={25}/>}

            {/* Form Dialog */}
            <PersonalDocForm
                open={openForm}
                onClose={handleCloseForm}
                documentData={editingDoc}
                refetchDocs={() => queryClient.invalidateQueries('personalDocuments')}
             />


            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingDocId} onClose={() => setDeletingDocId(null)}>
                 <DialogTitle>Подтверждение удаления</DialogTitle>
                 <DialogContent>
                      <Typography>Вы уверены, что хотите удалить этот личный документ?</Typography>
                 </DialogContent>
                 <DialogActions>
                      <Button onClick={() => setDeletingDocId(null)}>Отмена</Button>
                      <Button onClick={handleDeleteConfirm} color="error" disabled={deleteMutation.isLoading}>
                            {deleteMutation.isLoading ? <CircularProgress size={20} /> : 'Удалить'}
                      </Button>
                 </DialogActions>
            </Dialog>
        </Container>
    );
};

export default PersonalDocsPage;



