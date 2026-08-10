import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Box, CircularProgress, TextField, Grid } from '@mui/material';
import { format } from 'date-fns';
import LoadingSpinner from '../Common/LoadingSpinner';
import adminService from '../../services/adminService';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

const AuditLogTable = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [filters, setFilters] = useState({
         user_id: '',
         action: '',
         ip_address: '',
         date_gte: null,
         date_lte: null,
    });

    const queryParams = {
        page: page + 1,
        page_size: rowsPerPage,
        user: filters.user_id || undefined,
        action__icontains: filters.action || undefined,
        ip_address: filters.ip_address || undefined,
        timestamp__date__gte: filters.date_gte ? dayjs(filters.date_gte).format('YYYY-MM-DD') : undefined,
        timestamp__date__lte: filters.date_lte ? dayjs(filters.date_lte).format('YYYY-MM-DD') : undefined,
        ordering: '-timestamp',
    };

    const { data, error, isLoading, isFetching } = useQuery(
        ['adminAuditLogs', queryParams],
        () => adminService.getAuditLogs(queryParams),
        { keepPreviousData: true }
    );

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

    const logs = data?.results || [];
    const totalCount = data?.count || 0;

    return (
        <>
             <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Фильтры</Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={3}>
                         <TextField label="Пользователь (ID)" name="user_id" type="number" value={filters.user_id} onChange={handleFilterChange} variant="outlined" size="small" fullWidth />
                    </Grid>
                     <Grid item xs={12} sm={6} md={3}>
                         <TextField label="Действие (содержит)" name="action" value={filters.action} onChange={handleFilterChange} variant="outlined" size="small" fullWidth />
                     </Grid>
                     <Grid item xs={12} sm={6} md={3}>
                          <TextField label="IP Адрес" name="ip_address" value={filters.ip_address} onChange={handleFilterChange} variant="outlined" size="small" fullWidth />
                     </Grid>
                     <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
                        <Grid item xs={12} sm={6} md={3}>
                             <DatePicker label="Дата С" value={filters.date_gte} onChange={(d) => handleDateFilterChange('date_gte', d)} format="DD.MM.YYYY" slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
                        </Grid>
                         <Grid item xs={12} sm={6} md={3}>
                             <DatePicker label="Дата ПО" value={filters.date_lte} onChange={(d) => handleDateFilterChange('date_lte', d)} format="DD.MM.YYYY" minDate={filters.date_gte || undefined} slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
                         </Grid>
                     </LocalizationProvider>
                 </Grid>
            </Paper>

            {isLoading && <LoadingSpinner />}
            {error && <Typography color="error">Ошибка загрузки журнала: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer sx={{ maxHeight: 600 }}>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Время</TableCell>
                                    <TableCell>Пользователь</TableCell>
                                    <TableCell>Действие</TableCell>
                                    <TableCell>Описание / Результат</TableCell>
                                    <TableCell>IP Адрес</TableCell>
                                    <TableCell>User Agent</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow hover key={log.id}>
                                        <TableCell sx={{whiteSpace: 'nowrap'}}>{format(new Date(log.timestamp), 'dd.MM.yy HH:mm:ss')}</TableCell>
                                        <TableCell>{log.user?.full_name || log.user?.email || 'Система/Аноним'}</TableCell>
                                        <TableCell sx={{wordBreak: 'break-all'}}>{log.action}</TableCell>
                                        <TableCell sx={{wordBreak: 'break-all', maxWidth: 300}}>{log.description}</TableCell>
                                        <TableCell>{log.ip_address}</TableCell>
                                        <TableCell sx={{maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}><Tooltip title={log.user_agent}>{log.user_agent}</Tooltip></TableCell>
                                    </TableRow>
                                ))}
                                {logs.length === 0 && (
                                     <TableRow><TableCell colSpan={6} align="center">Записи аудита не найдены.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage="Записей на странице:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} из ${count !== -1 ? count : `больше чем ${to}`}`}
                    />
                </Paper>
            )}
            {isFetching && !isLoading && <CircularProgress size={20} sx={{ position: 'absolute', top: 10, right: 10 }}/>}
        </>
    );
};

export default AuditLogTable;




python

