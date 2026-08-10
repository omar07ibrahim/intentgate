import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Container, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Button, Chip, Box, CircularProgress, Tooltip, IconButton, MenuItem, Select, FormControl, InputLabel, TextField } from '@mui/material';
import { format } from 'date-fns';
import PageTitle from '../components/Common/PageTitle';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import leaveService from '../services/leaveService';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DoDisturbIcon from '@mui/icons-material/DoDisturb';

const LeaveListPage = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchParams, setSearchParams] = useSearchParams();
    const [filters, setFilters] = useState({
        status: searchParams.get('status') || '',
    });
    const queryClient = useQueryClient();

    const queryParams = {
        page: page + 1,
        page_size: rowsPerPage,
        status: filters.status || undefined, // Send undefined if empty
        ordering: '-start_date',
    };

    const { data, error, isLoading, isFetching, refetch } = useQuery(
        ['leaveRecords', queryParams],
        () => leaveService.getLeaveRecords(queryParams),
        { keepPreviousData: true }
    );

    const cancelMutation = useMutation(leaveService.cancelLeaveRequest, {
        onSuccess: () => {
            toast.success('Запрос на отсутствие отменен.');
            queryClient.invalidateQueries('leaveRecords');
        },
        onError: (error) => {
             toast.error(`Ошибка отмены: ${error.response?.data?.detail || error.message}`);
        },
    });

    const handleCancelRequest = (id) => {
        if (window.confirm('Вы уверены, что хотите отменить этот запрос?')) {
            cancelMutation.mutate(id);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilterChange = (event) => {
          const { name, value } = event.target;
          setFilters(prev => ({ ...prev, [name]: value }));
          setPage(0); // Reset page when filters change
          // Update URL
          const newSearchParams = new URLSearchParams(searchParams);
          if (value) {
              newSearchParams.set(name, value);
          } else {
               newSearchParams.delete(name);
          }
          setSearchParams(newSearchParams, { replace: true });
     };


    const getStatusChip = (status) => {
        switch (status) {
            case 'REQUESTED':
                return <Chip icon={<HourglassEmptyIcon />} label="Запрошено" color="warning" size="small" variant="outlined"/>;
            case 'APPROVED':
                return <Chip icon={<CheckCircleIcon />} label="Одобрено" color="success" size="small" variant="outlined"/>;
            case 'REJECTED':
                return <Chip icon={<DoDisturbIcon />} label="Отклонено" color="error" size="small" variant="outlined"/>;
            case 'CANCELLED':
                return <Chip icon={<CancelIcon />} label="Отменено" color="default" size="small" variant="outlined"/>;
            default:
                return <Chip label={status} size="small" />;
        }
    };

    const leaves = data?.results || [];
    const totalCount = data?.count || 0;

    return (
        <Container maxWidth="lg">
            <PageTitle title="История отпусков / Отсутствий">
                 <Button
                     variant="contained"
                     startIcon={<AddCircleOutlineIcon />}
                     component={RouterLink}
                     to="/leaves/request"
                 >
                     Новый запрос
                 </Button>
            </PageTitle>

             <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                     {/* Add more filters if needed: date range, type etc. */}
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id="status-filter-label">Статус</InputLabel>
                        <Select
                            labelId="status-filter-label"
                            label="Статус"
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                        >
                            <MenuItem value=""><em>Все</em></MenuItem>
                            <MenuItem value="REQUESTED">Запрошено</MenuItem>
                            <MenuItem value="APPROVED">Одобрено</MenuItem>
                            <MenuItem value="REJECTED">Отклонено</MenuItem>
                            <MenuItem value="CANCELLED">Отменено</MenuItem>
                        </Select>
                    </FormControl>
                 </Box>
            </Paper>

            {isLoading && <LoadingSpinner />}
            {error && <Typography color="error">Ошибка загрузки записей: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader aria-label="leave records table">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Тип отсутствия</TableCell>
                                    <TableCell>Дата начала</TableCell>
                                    <TableCell>Дата окончания</TableCell>
                                    <TableCell>Дней</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell>Дата запроса</TableCell>
                                    <TableCell>Одобрил/Отклонил</TableCell>
                                    <TableCell>Действия</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {leaves.map((leave) => (
                                    <TableRow hover key={leave.id}>
                                        <TableCell>{leave.leave_type?.name || '-'}</TableCell>
                                        <TableCell>{format(new Date(leave.start_date), 'dd.MM.yyyy')}</TableCell>
                                        <TableCell>{format(new Date(leave.end_date), 'dd.MM.yyyy')}</TableCell>
                                        <TableCell align="center">{leave.duration_days}</TableCell>
                                        <TableCell>{getStatusChip(leave.status)}</TableCell>
                                        <TableCell>{format(new Date(leave.requested_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                                        <TableCell>{leave.approved_by?.full_name || '-'}</TableCell>
                                        <TableCell>
                                             {leave.can_cancel && (
                                                <Tooltip title="Отменить запрос">
                                                     <span> {/* Span needed for tooltip on disabled button */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleCancelRequest(leave.id)}
                                                            color="error"
                                                            disabled={cancelMutation.isLoading && cancelMutation.variables === leave.id}
                                                         >
                                                            {cancelMutation.isLoading && cancelMutation.variables === leave.id ? <CircularProgress size={18} color="inherit"/> : <CancelIcon />}
                                                         </IconButton>
                                                     </span>
                                                </Tooltip>
                                             )}
                                             {/* Add View details button maybe? */}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {leaves.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center">Записи об отсутствиях не найдены.</TableCell>
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

export default LeaveListPage;


