import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Button, Chip, IconButton, Tooltip, CircularProgress, Dialog, Typography } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete'; // Deactivate
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; // Activate
import BlockIcon from '@mui/icons-material/Block';
import adminService from '../../services/adminService';
import UserForm from './UserForm'; // Create this component
import ConfirmDialog from '../Common/ConfirmDialog'; // Create this component

const UsersTable = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [openForm, setOpenForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null); // { action: 'deactivate'/'activate', userId: number, userName: string }
    const queryClient = useQueryClient();

    const queryParams = { page: page + 1, page_size: rowsPerPage };

    const { data, error, isLoading, isFetching } = useQuery(
        ['adminUsers', queryParams],
        () => adminService.getUsers(queryParams),
        { keepPreviousData: true }
    );

    const mutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries('adminUsers');
            setConfirmAction(null); // Close confirm dialog on success
        },
        onError: (error) => {
            toast.error(`Ошибка: ${error.response?.data?.detail || error.message}`);
            setConfirmAction(null);
        },
    };

    const activateMutation = useMutation(adminService.activateUser, mutationOptions);
    const deactivateMutation = useMutation(adminService.deactivateUser, mutationOptions);

    const handleOpenForm = (user = null) => {
        setEditingUser(user);
        setOpenForm(true);
    };

    const handleCloseForm = () => {
        setOpenForm(false);
        setEditingUser(null);
    };

    const handleConfirmAction = (action, user) => {
         setConfirmAction({ action, userId: user.id, userName: user.full_name || user.email });
    };

    const executeConfirmAction = () => {
         if (!confirmAction) return;
         if (confirmAction.action === 'deactivate') {
             toast.info(`Деактивация пользователя ${confirmAction.userName}...`);
             deactivateMutation.mutate(confirmAction.userId);
         } else if (confirmAction.action === 'activate') {
              toast.info(`Активация пользователя ${confirmAction.userName}...`);
             activateMutation.mutate(confirmAction.userId);
         }
    };


    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const users = data?.results || [];
    const totalCount = data?.count || 0;

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={() => handleOpenForm()}
                >
                    Добавить пользователя
                </Button>
            </Box>

            {isLoading && <CircularProgress />}
            {error && <Typography color="error">Ошибка загрузки пользователей: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Полное имя</TableCell>
                                    <TableCell>Роль</TableCell>
                                    <TableCell>Должность</TableCell>
                                    <TableCell>Подразделение</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell>Действия</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow hover key={user.id}>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.full_name}</TableCell>
                                        <TableCell>{user.role?.name || '-'}</TableCell>
                                        <TableCell>{user.position || '-'}</TableCell>
                                        <TableCell>{user.department || '-'}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.is_active ? 'Активен' : 'Неактивен'}
                                                color={user.is_active ? 'success' : 'default'}
                                                size="small"
                                                variant="outlined"
                                            />
                                            {user.is_staff && <Chip label="Админ" color="primary" size="small" sx={{ ml: 1 }} />}
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="Редактировать">
                                                <IconButton size="small" onClick={() => handleOpenForm(user)}>
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                             {user.is_active ? (
                                                  <Tooltip title="Деактивировать">
                                                      <span> {/* Disabled buttons need a span wrapper for tooltips */}
                                                         <IconButton
                                                              size="small"
                                                              onClick={() => handleConfirmAction('deactivate', user)}
                                                              color="error"
                                                              disabled={user.is_superuser || (deactivateMutation.isLoading && deactivateMutation.variables === user.id)}
                                                          >
                                                              <BlockIcon />
                                                          </IconButton>
                                                       </span>
                                                  </Tooltip>
                                              ) : (
                                                  <Tooltip title="Активировать">
                                                       <span>
                                                          <IconButton
                                                               size="small"
                                                               onClick={() => handleConfirmAction('activate', user)}
                                                               color="success"
                                                               disabled={user.is_superuser || (activateMutation.isLoading && activateMutation.variables === user.id)}
                                                           >
                                                              <CheckCircleIcon />
                                                           </IconButton>
                                                        </span>
                                                  </Tooltip>
                                              )}
                                        </TableCell>
                                    </TableRow>
                                ))}
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
                        labelRowsPerPage="Пользователей на странице:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} из ${count}`}
                    />
                </Paper>
            )}
            {isFetching && !isLoading && <CircularProgress size={20} sx={{ position: 'absolute', top: 10, right: 10 }}/>}

            {/* User Form Dialog */}
             <UserForm
                 open={openForm}
                 onClose={handleCloseForm}
                 userData={editingUser}
                 refetchUsers={() => queryClient.invalidateQueries('adminUsers')}
              />

            {/* Confirmation Dialog */}
             <ConfirmDialog
                 open={!!confirmAction}
                 onClose={() => setConfirmAction(null)}
                 onConfirm={executeConfirmAction}
                 title={confirmAction?.action === 'deactivate' ? "Деактивация пользователя" : "Активация пользователя"}
                 isLoading={deactivateMutation.isLoading || activateMutation.isLoading}
             >
                  <Typography>
                      Вы уверены, что хотите {confirmAction?.action === 'deactivate' ? 'деактивировать' : 'активировать'} пользователя
                      <strong> {confirmAction?.userName}</strong>?
                      {confirmAction?.action === 'deactivate' && " Он не сможет войти в систему."}
                  </Typography>
             </ConfirmDialog>
        </>
    );
};

export default UsersTable;


