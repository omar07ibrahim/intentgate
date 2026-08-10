import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Button, Chip, IconButton, Tooltip, CircularProgress, Dialog, Typography, TextField, Checkbox, FormControlLabel, Switch } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import documentService from '../../services/documentService';
import ConfirmDialog from '../Common/ConfirmDialog';
import { useForm, Controller } from 'react-hook-form';


// --- DocType Form Component (Inline for simplicity) ---
const DocTypeForm = ({ open, onClose, docTypeData, onSuccess }) => {
    const isEditing = !!docTypeData;
    const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
             name: '', description: '', is_personal: false, requires_acknowledgment: true, expiry_tracking_days: ''
        }
    });

    useEffect(() => {
        if (open) {
            reset({
                name: docTypeData?.name || '',
                description: docTypeData?.description || '',
                is_personal: docTypeData?.is_personal || false,
                requires_acknowledgment: docTypeData?.requires_acknowledgment ?? true, // Default to true if new
                expiry_tracking_days: docTypeData?.expiry_tracking_days || '',
            });
        }
    }, [open, docTypeData, reset]);

    const mutationFn = (data) => {
         // Convert expiry_tracking_days to integer or null
         const payload = {
              ...data,
              expiry_tracking_days: data.expiry_tracking_days ? parseInt(data.expiry_tracking_days, 10) : null,
         };
         return isEditing ? documentService.updateDocumentType(docTypeData.id, payload) : documentService.createDocumentType(payload);
    };

    const mutation = useMutation(mutationFn, {
         onSuccess: () => {
              toast.success(isEditing ? 'Тип документа обновлен' : 'Тип документа создан');
              onSuccess();
         },
         onError: (error) => {
              toast.error(`Ошибка: ${error.response?.data?.detail || error.response?.data?.name || error.message}`);
         }
     });

     const onSubmit = (data) => {
         mutation.mutate(data);
     };

     return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
             <DialogTitle>{isEditing ? 'Редактировать тип документа' : 'Добавить тип документа'}</DialogTitle>
             <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                 <DialogContent>
                      <Controller
                          name="name" control={control} rules={{ required: 'Название обязательно' }}
                          render={({ field }) => <TextField {...field} label="Название типа" fullWidth required autoFocus margin="dense" error={!!errors.name} helperText={errors.name?.message} />}
                      />
                      <Controller
                          name="description" control={control}
                          render={({ field }) => <TextField {...field} label="Описание" fullWidth multiline rows={3} margin="dense" />}
                      />
                      <Controller
                           name="is_personal" control={control}
                           render={({ field }) => <FormControlLabel control={<Switch {...field} checked={field.value} />} label="Личный документ сотрудника?" sx={{ mt: 1 }} />}
                       />
                       <Controller
                            name="requires_acknowledgment" control={control}
                            render={({ field }) => <FormControlLabel control={<Switch {...field} checked={field.value} />} label="Требует ознакомления?" sx={{ mt: 1 }} />}
                        />
                        <Controller
                             name="expiry_tracking_days" control={control}
                             rules={{ pattern: { value: /^[0-9]*$/, message: 'Только цифры' } }}
                             render={({ field }) => <TextField {...field} label="Дней до истечения для уведомления (для личных)" type="number" fullWidth margin="dense" error={!!errors.expiry_tracking_days} helperText={errors.expiry_tracking_days?.message} />}
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
const DocTypesTable = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [openForm, setOpenForm] = useState(false);
    const [editingDocType, setEditingDocType] = useState(null);
    const [deletingDocType, setDeletingDocType] = useState(null); // DocType object for confirm dialog
    const queryClient = useQueryClient();

    const queryParams = { page: page + 1, page_size: rowsPerPage };

    const { data, error, isLoading, isFetching } = useQuery(
        ['adminDocTypes', queryParams],
        () => documentService.getDocumentTypes(queryParams),
        { keepPreviousData: true }
    );

    const deleteMutation = useMutation(documentService.deleteDocumentType, {
        onSuccess: () => {
            toast.success('Тип документа удален.');
            setDeletingDocType(null);
            queryClient.invalidateQueries('adminDocTypes');
        },
        onError: (error) => {
             // Check for protected error
             if (error.response?.status === 400 && error.response?.data?.detail?.includes('protected')) {
                 toast.error('Ошибка: Невозможно удалить тип, так как существуют связанные с ним документы.');
             } else {
                  toast.error(`Ошибка удаления: ${error.response?.data?.detail || error.message}`);
             }
             setDeletingDocType(null);
        },
    });

    const handleOpenForm = (docType = null) => {
        setEditingDocType(docType);
        setOpenForm(true);
    };

    const handleCloseForm = () => {
        setOpenForm(false);
        setEditingDocType(null);
    };

     const handleFormSuccess = () => {
          queryClient.invalidateQueries('adminDocTypes');
          handleCloseForm();
     };


    const handleDeleteClick = (docType) => {
        setDeletingDocType(docType);
    };

    const handleDeleteConfirm = () => {
        if (deletingDocType) {
            deleteMutation.mutate(deletingDocType.id);
        }
    };


    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const docTypes = data?.results || [];
    const totalCount = data?.count || 0;

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={() => handleOpenForm()}
                >
                    Добавить тип документа
                </Button>
            </Box>

            {isLoading && <CircularProgress />}
            {error && <Typography color="error">Ошибка загрузки типов документов: {error.message}</Typography>}

            {!isLoading && !error && (
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Название</TableCell>
                                    <TableCell>Личный?</TableCell>
                                    <TableCell>Треб. ознакомл?</TableCell>
                                    <TableCell>Дней предупр.</TableCell>
                                    <TableCell align="right">Действия</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {docTypes.map((type) => (
                                    <TableRow hover key={type.id}>
                                        <TableCell>{type.name}</TableCell>
                                        <TableCell>{type.is_personal ? <CheckBoxIcon color="primary"/> : <CheckBoxOutlineBlankIcon color="disabled"/>}</TableCell>
                                        <TableCell>{type.requires_acknowledgment ? <CheckBoxIcon color="primary"/> : <CheckBoxOutlineBlankIcon color="disabled"/>}</TableCell>
                                        <TableCell>{type.expiry_tracking_days ?? '-'}</TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Редактировать">
                                                <IconButton size="small" onClick={() => handleOpenForm(type)}>
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Удалить">
                                                 <span>
                                                     <IconButton
                                                         size="small"
                                                         onClick={() => handleDeleteClick(type)}
                                                         color="error"
                                                     >
                                                         <DeleteIcon />
                                                     </IconButton>
                                                 </span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {docTypes.length === 0 && (
                                     <TableRow><TableCell colSpan={5} align="center">Типы документов не найдены.</TableCell></TableRow>
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
                        labelRowsPerPage="Типов на странице:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} из ${count}`}
                    />
                </Paper>
            )}
            {isFetching && !isLoading && <CircularProgress size={20} sx={{ position: 'absolute', top: 10, right: 10 }}/>}

            {/* DocType Form Dialog */}
             <DocTypeForm
                 open={openForm}
                 onClose={handleCloseForm}
                 docTypeData={editingDocType}
                 onSuccess={handleFormSuccess}
              />

             {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                 open={!!deletingDocType}
                 onClose={() => setDeletingDocType(null)}
                 onConfirm={handleDeleteConfirm}
                 title="Удаление типа документа"
                 isLoading={deleteMutation.isLoading}
             >
                  <Typography>
                      Вы уверены, что хотите удалить тип документа <strong>{deletingDocType?.name}</strong>?
                      Это действие невозможно отменить. Если существуют документы этого типа, удаление не будет выполнено.
                  </Typography>
             </ConfirmDialog>
        </>
    );
};

export default DocTypesTable;



