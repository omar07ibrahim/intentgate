import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Container, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Button, Chip, Box, CircularProgress, Tooltip, IconButton, MenuItem, Select, FormControl, InputLabel, TextField } from '@mui/material';
import { format } from 'date-fns';
import PageTitle from '../../components/Common/PageTitle';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import leaveService from '../../services/leaveService';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel'; // Use for Reject/Cancel
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DoDisturbIcon from '@mui/icons-material/DoDisturb';
import ConfirmDialog from '../Common/ConfirmDialog';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

const LeaveManagementTable = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [filters, setFilters] = useState({
        status: 'REQUESTED', // Default to show pending requests
        user_id: '',
        start_date_gte: null,
        end_date_lte: null,
    });
    const [manageAction, setManageAction] = useState(null); // { action: 'approve'/'reject', leaveId: number, userName: string }
    const [rejectReason, setRejectReason] = useState(''); // For reject dialog
    const queryClient = useQueryClient();

    const queryParams = {
        page: page + 1,
        page_size: rowsPerPage,
        status: filters.status || undefined,
        user: filters.user_id || undefined,
        start_date_gte: filters.start_date_gte ? dayjs(filters.start_date_gte).format('YYYY-MM-DD') : undefined,
        end_date_lte: filters.end_date_lte ? dayjs(filters.end_date_lte).format('YYYY-MM-DD') : undefined,
        ordering: '-requested_at', // Show newest requests first by default
    };

    const { data, error, isLoading, isFetching } = useQuery(
        ['adminLeaveRecords', queryParams],
        () => leaveService.getLeaveRecords(queryParams),
        { keepPreviousData: true }
    );

     // Mutations for approve/reject
     const approveMutation = useMutation(leaveService.approveLeave, {
         onSuccess: () => {
             toast.success('Запрос одобрен.');
             setManageAction(null);
             queryClient.invalidateQueries('adminLeaveRecords');
         },
         onError: (error) => {
             toast.error(`Ошибка одобрения: ${error.response?.data?.detail || error.message}`);
             setManageAction(null);
         },
     });

     const rejectMutation = useMutation(({ id, reason }) => leaveService.rejectLeave(id, reason), {
         onSuccess: () => {
             toast.success('Запрос отклонен.');
             setManageAction(null);
             setRejectReason('');
             queryClient.invalidateQueries('adminLeaveRecords');
         },
         onError: (error) => {
             toast.error(`Ошибка отклонения: ${error.response?.data?.detail || error.message}`);
             setManageAction(null);
             setRejectReason('');
         },
     });


    const handleManageAction = (action, leave) => {
        setManageAction({ action, leaveId: leave.id, userName: leave.user?.full_name || leave.user?.email });
         setRejectReason(action === 'reject' ? (leave.reason || '') : ''); // Prefill reason for rejection if available
    };

    const executeManageAction = () => {
         if (!manageAction) return;
         if (manageAction.action === 'approve') {
             approveMutation.mutate(manageAction.leaveId);
         } else if (manageAction.action === 'reject') {
             rejectMutation.mutate({ id: manageAction.leaveId, reason: rejectReason });
         }
    };


    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setPage(0);
    };

     const handleDateFilterChange = (name, date) => {
         setFilters(prev => ({ ...prev, [name]: date }));
         setPage(0);
     };

     const clearFilters = () => {
          setFilters({ status: 'REQUESTED', user_id: '', start_date_gte: null, end_date_lte: null });
          setPage(0);
     };

    const getStatusChip = (status) => {
         switch (status) {
             case 'REQUESTED': return <Chip icon={<HourglassEmptyIcon />} label="Запрошено" color="warning" size="small" variant="outlined"/>;
             case 'APPROVED': return <Chip icon={<CheckCircleIcon />} label="Одобрено" color="success" size="small" variant="outlined"/>;
             case 'REJECTED': return <Chip icon={<DoDisturbIcon />} label="Отклонено" color="error" size="small" variant="outlined"/>;
             case 'CANCELLED': return <Chip icon={<CancelIcon />} label="Отменено" color="default" size="small" variant="outlined"/>;
             default: return <Chip label={status} size="small" />;
         }
    };


    const leaves = data?.results || [];
    const totalCount = data?.count || 0;
    const mutationLoading = approveMutation.isLoading || rejectMutation.isLoading;

    return (
        <>
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Фильтры</Typography>
                <Grid container spacing={2} alignItems="center">
                     <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            label="Поиск по сотруднику (ID)" // Add user search component later
                            name="user_id"
                            type="number"
                            value={filters.user_id}
                            onChange={handleFilterChange}
                            variant="outlined"
                            size="small"
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl size="small" fullWidth>
                            <InputLabel>Статус</InputLabel>
                            <Select
                                label="Статус" name="status"
                                value={filters.status} onChange={handleFilterChange}
                            >
                                <MenuItem value=""><em>Все</em></MenuItem>
                                <MenuItem value="REQUESTED">Запрошено</MenuItem>
                                <MenuItem value="APPROVED">Одобрено</MenuItem>
                                <MenuItem value="REJECTED">Отклонено</MenuItem>
                                <MenuItem value="CANCELLED">Отменено</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                     <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
                        <Grid item xs={12} sm={6} md={3}>
                             <DatePicker
                                 label="Начало периода С"
                                 value={filters.start_date_gte}
                                 onChange={(date) => handleDateFilterChange('start_date_gte', date)}
                                 format="DD.MM.YYYY"
                                 slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                             />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                              <DatePicker
                                  label="Конец периода ПО"
                                  value={filters.end_date_lte}
                                  onChange={(date) => handleDateFilterChange('end_date_lte', date)}
                                  format="DD.MM.YYYY"
                                  minDate={filters.start_date_gte || undefined}
                                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                              />
                        </Grid>
                     </LocalizationProvider>
                      <Grid item xs={12} sx={{ textAlign: 'right' }}>
                          <Button onClick={clearFilters} size="small">Сбросить фильтры</Button>
                      </Grid>
                </Grid>
            </Paper>

            {isLoading && <LoadingSpinner />}
            {error && <Typography color="error">Ошибка загрузки записей: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Сотрудник</TableCell>
                                    <TableCell>Тип</TableCell>
                                    <TableCell>Даты</TableCell>
                                    <TableCell>Дней</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell>Причина</TableCell>
                                    <TableCell>Запрошено</TableCell>
                                    <TableCell>Обработано</TableCell>
                                    <TableCell>Действия</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {leaves.map((leave) => (
                                    <TableRow hover key={leave.id}>
                                        <TableCell>{leave.user?.full_name || leave.user?.email}</TableCell>
                                        <TableCell>{leave.leave_type?.name || '-'}</TableCell>
                                        <TableCell>{format(new Date(leave.start_date), 'dd.MM.yy')} - {format(new Date(leave.end_date), 'dd.MM.yy')}</TableCell>
                                        <TableCell align="center">{leave.duration_days}</TableCell>
                                        <TableCell>{getStatusChip(leave.status)}</TableCell>
                                        <TableCell><Tooltip title={leave.reason}><Typography noWrap sx={{maxWidth: 150}}>{leave.reason || '-'}</Typography></Tooltip></TableCell>
                                        <TableCell>{format(new Date(leave.requested_at), 'dd.MM.yy HH:mm')}</TableCell>
                                        <TableCell>{leave.processed_at ? format(new Date(leave.processed_at), 'dd.MM.yy HH:mm') : '-'} ({leave.approved_by?.full_name || ''})</TableCell>
                                        <TableCell>
                                            {leave.status === 'REQUESTED' && (
                                                <>
                                                     <Tooltip title="Одобрить">
                                                          <IconButton size="small" onClick={() => handleManageAction('approve', leave)} color="success" disabled={mutationLoading}>
                                                              <CheckCircleIcon />
                                                          </IconButton>
                                                     </Tooltip>
                                                     <Tooltip title="Отклонить">
                                                           <IconButton size="small" onClick={() => handleManageAction('reject', leave)} color="error" disabled={mutationLoading}>
                                                              <CancelIcon />
                                                           </IconButton>
                                                     </Tooltip>
                                                 </>
                                            )}
                                             {/* Add maybe a view details action later */}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {leaves.length === 0 && (
                                    <TableRow><TableCell colSpan={9} align="center">Записи не найдены.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage="Записей на странице:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} из ${count}`}
                    />
                </Paper>
            )}
             {isFetching && !isLoading && <CircularProgress size={20} sx={{ position: 'absolute', top: 10, right: 10 }}/>}

             {/* Confirmation/Action Dialog */}
             <ConfirmDialog
                  open={!!manageAction}
                  onClose={() => setManageAction(null)}
                  onConfirm={executeManageAction}
                  title={manageAction?.action === 'approve' ? "Одобрение запроса" : "Отклонение запроса"}
                  isLoading={mutationLoading}
             >
                 <Typography>
                      Вы уверены, что хотите {manageAction?.action === 'approve' ? 'одобрить' : 'отклонить'} запрос на отсутствие для
                      <strong> {manageAction?.userName}</strong>?
                 </Typography>
                 {manageAction?.action === 'reject' && (
                      <TextField
                          label="Причина отклонения (необязательно)"
                          multiline
                          rows={2}
                          fullWidth
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          sx={{ mt: 2 }}
                      />
                 )}
             </ConfirmDialog>
        </>
    );
};

export default LeaveManagementTable;



