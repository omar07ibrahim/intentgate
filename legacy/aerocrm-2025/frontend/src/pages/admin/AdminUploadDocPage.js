import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, TextField, Button, Grid, MenuItem, CircularProgress, Box, Typography, Autocomplete } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import PageTitle from '../../components/Common/PageTitle';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import documentService from '../../services/documentService';
import adminService from '../../services/adminService';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ClearIcon from '@mui/icons-material/Clear';


const AdminUploadDocPage = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [fileName, setFileName] = React.useState('');
    const [assigneeInput, setAssigneeInput] = React.useState('');
    const [roleInput, setRoleInput] = React.useState(''); // Not used for search, just state

    const { control, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            title: '',
            document_type: '',
            document_file: null,
            assignee_ids: [],
            assignee_role_ids: [],
            acknowledgment_deadline: null,
        }
    });

    // Fetch Document Types (non-personal)
    const { data: docTypesData, isLoading: docTypesLoading } = useQuery(
        'generalDocTypes',
        () => documentService.getDocumentTypes({ is_personal: false, page_size: 1000 })
    );

    // Fetch Roles for assignment
    const { data: rolesData, isLoading: rolesLoading } = useQuery(
        'allRolesForUpload',
        () => adminService.getRoles({ page_size: 1000 })
    );

    // Fetch Users for assignment (with debounce/search if needed)
    // Simple fetch all for now, assuming not thousands of users for direct assign
    const { data: usersData, isLoading: usersLoading } = useQuery(
         'allUsersForUpload',
         () => adminService.getUsers({ page_size: 2000, is_active: true }) // Fetch active users
    );

    const mutation = useMutation(documentService.uploadGeneralDocument, {
        onSuccess: (data) => {
            toast.success('Документ успешно загружен и назначен.');
            queryClient.invalidateQueries('generalDocuments');
            reset(); // Reset form
            setFileName('');
            // Optionally navigate to the created document's detail page
            // navigate(`/documents/general/${data.id}`);
        },
        onError: (error) => {
            const errorMsg = error.response?.data;
             let readableError = "Ошибка загрузки документа.";
             if (typeof errorMsg === 'string') {
                 readableError = errorMsg;
             } else if (typeof errorMsg === 'object' && errorMsg !== null) {
                 const firstErrorKey = Object.keys(errorMsg)[0];
                  if (firstErrorKey && Array.isArray(errorMsg[firstErrorKey])) {
                       readableError = `${firstErrorKey}: ${errorMsg[firstErrorKey][0]}`;
                  } else {
                       readableError = JSON.stringify(errorMsg);
                  }
             }
             toast.error(`Ошибка: ${readableError}`);
        },
    });

    const onSubmit = (data) => {
        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('document_type', data.document_type);
        if (data.document_file instanceof File) {
             formData.append('document_file', data.document_file);
         }
         if (data.acknowledgment_deadline) {
             formData.append('acknowledgment_deadline', dayjs(data.acknowledgment_deadline).toISOString());
         }
        data.assignee_ids.forEach(id => formData.append('assignee_ids', id));
        data.assignee_role_ids.forEach(id => formData.append('assignee_role_ids', id));

        mutation.mutate(formData);
    };

     const handleFileChange = (event) => {
         const file = event.target.files[0];
         if (file) {
              setValue('document_file', file, { shouldValidate: true });
              setFileName(file.name);
         }
     };

      const handleRemoveFile = () => {
           setValue('document_file', null, { shouldValidate: true });
           setFileName('');
           const fileInput = document.getElementById('general-doc-file-input');
           if (fileInput) fileInput.value = '';
      };


    const docTypes = docTypesData?.results || [];
    const roles = rolesData?.results || [];
    const users = usersData?.results || [];
    const isLoading = docTypesLoading || rolesLoading || usersLoading || mutation.isLoading;

    return (
        <Container maxWidth="md">
            <PageTitle title="Загрузка общего документа" />
            <Paper sx={{ p: 3 }}>
                 {isLoading && <CircularProgress sx={{position: 'absolute', top: 70, left: '50%', zIndex: 10}}/>}
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Controller name="title" control={control} rules={{ required: 'Название документа обязательно' }}
                                render={({ field }) => <TextField {...field} label="Название документа" fullWidth required autoFocus error={!!errors.title} helperText={errors.title?.message} />}
                            />
                        </Grid>
                         <Grid item xs={12}>
                             <Controller name="document_type" control={control} rules={{ required: 'Выберите тип документа' }}
                                 render={({ field }) => (
                                      <TextField {...field} select label="Тип документа" fullWidth required error={!!errors.document_type} helperText={errors.document_type?.message} disabled={docTypesLoading}>
                                           <MenuItem value=""><em>-- Выберите тип --</em></MenuItem>
                                           {docTypes.map(type => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
                                      </TextField>
                                  )}
                             />
                        </Grid>
                         <Grid item xs={12}>
                              <Typography variant="body2" gutterBottom>Файл документа *:</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', border: '1px dashed grey', p: 1, borderRadius: 1 }}>
                                  <Button variant="outlined" component="label" size="small" startIcon={<UploadFileIcon />} >
                                       Выбрать файл
                                      <input id="general-doc-file-input" type="file" hidden onChange={handleFileChange} />
                                  </Button>
                                   {fileName && (
                                        <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                                             <Typography variant="body2" noWrap sx={{ mr: 1 }}>{fileName}</Typography>
                                             <IconButton onClick={handleRemoveFile} size="small" title="Убрать файл"><ClearIcon fontSize="small" /></IconButton>
                                         </Box>
                                   )}
                               </Box>
                               {errors.document_file && <Typography color="error" variant="caption">{errors.document_file.message}</Typography>}
                               {/* Controller for file validation (required check) */}
                               <Controller name="document_file" control={control} rules={{ required: 'Файл документа обязателен' }} render={({ field }) => <input type="hidden" {...field} />}/>

                         </Grid>

                         <Grid item xs={12} sm={6}>
                              <Controller name="assignee_ids" control={control}
                                   render={({ field: { onChange, value, ...fieldProps } }) => (
                                       <Autocomplete
                                            multiple
                                            options={users}
                                            getOptionLabel={(option) => `${option.full_name} (${option.email})`}
                                            value={users.filter(user => value.includes(user.id))} // Control value based on IDs
                                            onChange={(event, newValue) => {
                                                 onChange(newValue.map(item => item.id)); // Update RHF with array of IDs
                                             }}
                                            loading={usersLoading}
                                            renderInput={(params) => (
                                                <TextField {...params} label="Назначить сотрудникам (поиск)" variant="outlined"
                                                     InputProps={{
                                                         ...params.InputProps,
                                                         endAdornment: (
                                                              <>
                                                                  {usersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                                                  {params.InputProps.endAdornment}
                                                              </>
                                                         ),
                                                    }}
                                                 />
                                            )}
                                            isOptionEqualToValue={(option, value) => option.id === value.id}
                                            {...fieldProps}
                                        />
                                    )}
                               />
                         </Grid>
                         <Grid item xs={12} sm={6}>
                              <Controller name="assignee_role_ids" control={control}
                                  render={({ field: { onChange, value, ...fieldProps } }) => (
                                       <Autocomplete
                                            multiple
                                            options={roles}
                                            getOptionLabel={(option) => option.name}
                                            value={roles.filter(role => value.includes(role.id))}
                                            onChange={(event, newValue) => {
                                                 onChange(newValue.map(item => item.id));
                                            }}
                                            loading={rolesLoading}
                                            renderInput={(params) => (
                                                <TextField {...params} label="Назначить ролям" variant="outlined"
                                                     InputProps={{
                                                          ...params.InputProps,
                                                          endAdornment: (
                                                               <>
                                                                    {rolesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                                                    {params.InputProps.endAdornment}
                                                               </>
                                                           ),
                                                      }}
                                                 />
                                            )}
                                            isOptionEqualToValue={(option, value) => option.id === value.id}
                                            {...fieldProps}
                                        />
                                  )}
                              />
                         </Grid>

                         <Grid item xs={12}>
                              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
                                  <Controller name="acknowledgment_deadline" control={control}
                                      render={({ field }) => (
                                          <DateTimePicker
                                                {...field}
                                               label="Срок ознакомления (необязательно)"
                                               format="DD.MM.YYYY HH:mm"
                                               ampm={false}
                                               minDateTime={dayjs()}
                                               slotProps={{ textField: { fullWidth: true, error: !!errors.acknowledgment_deadline, helperText: errors.acknowledgment_deadline?.message } }}
                                           />
                                      )}
                                  />
                              </LocalizationProvider>
                         </Grid>

                         <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                             <Button
                                 type="submit"
                                 variant="contained"
                                 disabled={isLoading || isSubmitting}
                                 startIcon={<UploadFileIcon />}
                             >
                                 {isLoading || isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Загрузить и назначить'}
                             </Button>
                         </Grid>
                    </Grid>
                </Box>
            </Paper>
        </Container>
    );
};

export default AdminUploadDocPage;


