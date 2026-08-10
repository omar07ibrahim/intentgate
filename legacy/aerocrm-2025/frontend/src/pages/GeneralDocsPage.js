import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import documentService from '../services/documentService';
import { Container, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Button, Chip, Box, CircularProgress, TextField, MenuItem, FormControl, InputLabel, Select } from '@mui/material';
import { format } from 'date-fns'; // Or dayjs
import PageTitle from '../components/Common/PageTitle';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DownloadIcon from '@mui/icons-material/Download';

const GeneralDocsPage = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchParams, setSearchParams] = useSearchParams();
    const [filters, setFilters] = useState({
         search: searchParams.get('search') || '',
         acknowledged: searchParams.get('acknowledged') || '', // 'true', 'false', ''
    });
    const queryClient = useQueryClient();

    const queryParams = {
        page: page + 1, // API uses 1-based pagination
        page_size: rowsPerPage,
        search: filters.search,
        // Filter by acknowledged status based on user's perspective
        // Backend needs to handle this based on request.user
         acknowledged: filters.acknowledged === 'true' ? true : filters.acknowledged === 'false' ? false : undefined,
    };

    // Fetching documents
    const { data, error, isLoading, isFetching } = useQuery(
        ['generalDocuments', queryParams], // Query key includes params
        () => documentService.getGeneralDocuments(queryParams),
        { keepPreviousData: true } // Smooth pagination
    );

    // Mutation for acknowledging
    const acknowledgeMutation = useMutation(documentService.acknowledgeDocument, {
        onSuccess: (updatedAssignment) => {
            toast.success('Ознакомление подтверждено!');
            // Invalidate or update query cache to reflect the change
            queryClient.invalidateQueries('generalDocuments');
            // Optionally update the specific item in cache for immediate UI feedback
            // queryClient.setQueryData(['generalDocuments', queryParams], (oldData) => { ... update logic ... });
        },
        onError: (error) => {
             toast.error(`Ошибка подтверждения: ${error.response?.data?.detail || error.message}`);
        },
    });

    useEffect(() => {
        // Update URL search params when filters change
        const newSearchParams = new URLSearchParams();
        if (filters.search) newSearchParams.set('search', filters.search);
        if (filters.acknowledged) newSearchParams.set('acknowledged', filters.acknowledged);
        setSearchParams(newSearchParams, { replace: true });
    }, [filters, setSearchParams]);

    const handleAcknowledge = (docId) => {
        acknowledgeMutation.mutate(docId);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0); // Reset to first page
    };

     const handleFilterChange = (event) => {
          const { name, value } = event.target;
          setFilters(prev => ({ ...prev, [name]: value }));
          setPage(0); // Reset page when filters change
     };


    const documents = data?.results || [];
    const totalCount = data?.count || 0;

    return (
        <Container maxWidth="lg">
            <PageTitle title="Общие документы для ознакомления" />

             <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        label="Поиск по названию"
                        name="search"
                        value={filters.search}
                        onChange={handleFilterChange}
                        variant="outlined"
                        size="small"
                        sx={{ flexGrow: 1 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id="acknowledged-filter-label">Статус ознакомления</InputLabel>
                        <Select
                            labelId="acknowledged-filter-label"
                            label="Статус ознакомления"
                            name="acknowledged"
                            value={filters.acknowledged}
                            onChange={handleFilterChange}
                        >
                            <MenuItem value=""><em>Все</em></MenuItem>
                            <MenuItem value="true">Ознакомлен</MenuItem>
                            <MenuItem value="false">Не ознакомлен</MenuItem>
                        </Select>
                    </FormControl>
                 </Box>
            </Paper>

            {isLoading && <LoadingSpinner />}
            {error && <Typography color="error">Ошибка загрузки документов: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader aria-label="general documents table">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Название документа</TableCell>
                                    <TableCell>Тип</TableCell>
                                    <TableCell>Дата загрузки</TableCell>
                                    <TableCell>Срок ознакомления</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell>Действия</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {documents.map((doc) => (
                                    <TableRow hover key={doc.id}>
                                        <TableCell>
                                             <RouterLink to={`/documents/general/${doc.id}`}>
                                                {doc.title}
                                            </RouterLink>
                                        </TableCell>
                                        <TableCell>{doc.document_type?.name || '-'}</TableCell>
                                        <TableCell>{format(new Date(doc.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                                        <TableCell>
                                            {doc.acknowledgment_deadline ? format(new Date(doc.acknowledgment_deadline), 'dd.MM.yyyy HH:mm') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {doc.my_assignment ? (
                                                doc.my_assignment.is_acknowledged ? (
                                                    <Chip
                                                        icon={<CheckCircleIcon />}
                                                        label={`Ознакомлен ${format(new Date(doc.my_assignment.acknowledged_at), 'dd.MM.yyyy')}`}
                                                        color="success"
                                                        size="small"
                                                        variant="outlined"
                                                     />
                                                ) : (
                                                    <Chip
                                                        icon={<HourglassEmptyIcon />}
                                                        label="Ожидает ознакомления"
                                                        color="warning"
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                )
                                            ) : (
                                                 <Chip label="Не назначено" size="small" /> // Should not happen if query is correct
                                            )}
                                        </TableCell>
                                        <TableCell>
                                             {doc.document_file_url && (
                                                 <Button
                                                      size="small"
                                                      startIcon={<DownloadIcon />}
                                                      href={doc.document_file_url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      sx={{ mr: 1}}
                                                 >
                                                      Скачать
                                                 </Button>
                                             )}
                                            {doc.my_assignment && !doc.my_assignment.is_acknowledged && (
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    size="small"
                                                    onClick={() => handleAcknowledge(doc.id)}
                                                    disabled={acknowledgeMutation.isLoading && acknowledgeMutation.variables === doc.id}
                                                >
                                                     {acknowledgeMutation.isLoading && acknowledgeMutation.variables === doc.id ? <CircularProgress size={18} color="inherit"/> : 'Ознакомлен'}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {documents.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">Документы не найдены</TableCell>
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
        </Container>
    );
};

export default GeneralDocsPage;


