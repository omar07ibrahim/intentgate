import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Container, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Box, CircularProgress, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import PageTitle from '../../components/Common/PageTitle';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import adminService from '../../services/adminService';
import ConfirmDialog from '../../components/Common/ConfirmDialog'; // Reusable confirmation
import { useForm, Controller } from 'react-hook-form';


// --- Role Form Component (Inline for simplicity) ---
const RoleForm = ({ open, onClose, roleData, onSuccess }) => {
    const isEditing = !!roleData;
    const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
        defaultValues: { name: '', description: '' }
    });

    useEffect(() => {
        if (open) {
            reset({
                name: roleData?.name || '',
                description: roleData?.description || '',
            });
        }
    }, [open, roleData, reset]);

    const mutationFn = (data) => {
         return isEditing ? adminService.updateRole(roleData.id, data) : adminService.createRole(data);
    };

    const mutation = useMutation(mutationFn, {
         onSuccess: () => {
              toast.success(isEditing ? 'Роль обновлена' : 'Роль создана');
              onSuccess(); // Callback provided by parent (e.g., invalidate query, close form)
         },
         onError: (error) => {
              toast.error(`Ошибка: ${error.response?.data?.detail || error.response?.data?.name || error.message}`);
         }
     });

     const onSubmit = (data) => {
         mutation.mutate(data);
     };

     return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
             <DialogTitle>{isEditing ? 'Редактировать роль' : 'Добавить роль'}</DialogTitle>
             <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                 <DialogContent>
                      <Controller
                          name="name"
                          control={control}
                          rules={{ required: 'Название роли обязательно' }}
                          render={({ field }) => (
                              <TextField {...field} label="Название роли" fullWidth required autoFocus margin="dense" error={!!errors.name} helperText={errors.name?.message} />
                           )}
                      />
                      <Controller
                          name="description"
                          control={control}
                          render={({ field }) => (
                               <TextField {...field} label="Описание" fullWidth multiline rows={3} margin="dense" />
                           )}
                      />
                 </DialogContent>
                 <DialogActions>
                     <Button onClick={onClose}>Отмена</Button>
                     <Button type="submit" variant="contained" disabled={isSubmitting || mutation.isLoading}>
                         {isSubmitting || mutation.isLoading ? <CircularProgress size={24} /> : (isEditing ? 'Сохранить' : 'Создать')}
                     </Button>
                 </DialogActions>
             </Box>
         </Dialog>
     );
};


// --- Main Page Component ---
const AdminRolesPage = () => {
    const [openForm, setOpenForm] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [deletingRoleId, setDeletingRoleId] = useState(null); // Role ID to confirm deletion
    const queryClient = useQueryClient();

    // Fetch Roles (no pagination needed likely)
    const { data, error, isLoading, isFetching } = useQuery(
        'adminRoles',
        () => adminService.getRoles({ page_size: 1000 }), // Assume fewer than 1000 roles
        { keepPreviousData: true }
    );

    const deleteMutation = useMutation(adminService.deleteRole, {
        onSuccess: () => {
            toast.success('Роль удалена.');
            setDeletingRoleId(null);
            queryClient.invalidateQueries('adminRoles');
        },
        onError: (error) => {
             toast.error(`Ошибка удаления: ${error.response?.data?.detail || error.message}`);
             setDeletingRoleId(null);
        },
    });

    const handleOpenForm = (role = null) => {
        setEditingRole(role);
        setOpenForm(true);
    };

    const handleCloseForm = () => {
        setOpenForm(false);
        setEditingRole(null);
    };

    const handleFormSuccess = () => {
         queryClient.invalidateQueries('adminRoles');
         handleCloseForm();
    };

    const handleDeleteClick = (role) => {
        setDeletingRoleId(role); // Store the whole role object for the confirmation message
    };

    const handleDeleteConfirm = () => {
        if (deletingRoleId) {
            deleteMutation.mutate(deletingRoleId.id);
        }
    };


    const roles = data?.results || [];

    return (
        <Container maxWidth="md">
            <PageTitle title="Управление ролями пользователей">
                 <Button
                     variant="contained"
                     startIcon={<AddCircleOutlineIcon />}
                     onClick={() => handleOpenForm()}
                 >
                     Добавить роль
                 </Button>
            </PageTitle>

            {isLoading && <LoadingSpinner />}
            {error && <Typography color="error">Ошибка загрузки ролей: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ width: '100%', overflow: 'hidden', mt: 2 }}>
                    <TableContainer>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Название роли</TableCell>
                                    <TableCell>Описание</TableCell>
                                    <TableCell align="right">Действия</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {roles.map((role) => (
                                    <TableRow hover key={role.id}>
                                        <TableCell>{role.name}</TableCell>
                                        <TableCell>{role.description || '-'}</TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Редактировать">
                                                <IconButton size="small" onClick={() => handleOpenForm(role)}>
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Удалить">
                                                 <span> {/* Prevent deleting Admin role maybe */}
                                                     <IconButton
                                                         size="small"
                                                         onClick={() => handleDeleteClick(role)}
                                                         color="error"
                                                         disabled={role.name === 'Администратор'} // Example protection
                                                     >
                                                         <DeleteIcon />
                                                     </IconButton>
                                                 </span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {roles.length === 0 && (
                                     <TableRow><TableCell colSpan={3} align="center">Роли не найдены.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {/* No pagination needed if few roles */}
                </Paper>
            )}
            {isFetching && !isLoading && <CircularProgress size={20} sx={{ position: 'absolute', top: 10, right: 10 }}/>}

            {/* Role Form Dialog */}
             <RoleForm
                open={openForm}
                onClose={handleCloseForm}
                roleData={editingRole}
                onSuccess={handleFormSuccess}
              />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                 open={!!deletingRoleId}
                 onClose={() => setDeletingRoleId(null)}
                 onConfirm={handleDeleteConfirm}
                 title="Удаление роли"
                 isLoading={deleteMutation.isLoading}
             >
                  <Typography>
                      Вы уверены, что хотите удалить роль <strong>{deletingRoleId?.name}</strong>?
                       Это действие не может быть отменено. Пользователи с этой ролью потеряют ее.
                  </Typography>
             </ConfirmDialog>
        </Container>
    );
};

export default AdminRolesPage;


