import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid, MenuItem, CircularProgress, Box, Typography, FormControlLabel, Checkbox, Switch, Avatar } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import adminService from '../../services/adminService';

const UserForm = ({ open, onClose, userData, refetchUsers }) => {
    const queryClient = useQueryClient();
    const isEditing = !!userData;
    const [profilePicturePreview, setProfilePicturePreview] = useState(null);

    const { data: rolesData, isLoading: rolesLoading } = useQuery(
        'allRoles',
        () => adminService.getRoles({ page_size: 1000 }), // Fetch all roles
        { enabled: open } // Fetch only when dialog is open
    );

    const { control, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } = useForm({
        defaultValues: {
            email: '',
            first_name: '',
            last_name: '',
            patronymic: '',
            role_id: '',
            employee_id: '',
            position: '',
            department: '',
            shift: '',
            hire_date: null,
            phone_number: '',
            password: '',
            password2: '',
            is_active: true,
            is_staff: false,
            profile_picture: null,
        }
    });

    const profilePictureFile = watch('profile_picture');

    useEffect(() => {
        if (open) {
            if (isEditing && userData) {
                reset({
                    email: userData.email || '',
                    first_name: userData.first_name || '',
                    last_name: userData.last_name || '',
                    patronymic: userData.patronymic || '',
                    role_id: userData.role?.id || '',
                    employee_id: userData.employee_id || '',
                    position: userData.position || '',
                    department: userData.department || '',
                    shift: userData.shift || '',
                    hire_date: userData.hire_date ? dayjs(userData.hire_date) : null,
                    phone_number: userData.phone_number || '',
                    password: '', // Don't prefill password
                    password2: '',
                    is_active: userData.is_active,
                    is_staff: userData.is_staff,
                    profile_picture: null, // Don't prefill file input
                });
                setProfilePicturePreview(userData.profile_picture_url || null);
            } else {
                // Reset form for new entry
                reset({
                    email: '', first_name: '', last_name: '', patronymic: '',
                    role_id: '', employee_id: '', position: '', department: '', shift: '',
                    hire_date: null, phone_number: '', password: '', password2: '',
                    is_active: true, is_staff: false, profile_picture: null,
                });
                 setProfilePicturePreview(null);
            }
        }
    }, [open, userData, isEditing, reset]);

     useEffect(() => {
         // Update preview when file changes via RHF
         if (profilePictureFile instanceof File) {
             const reader = new FileReader();
             reader.onloadend = () => {
                 setProfilePicturePreview(reader.result);
             };
             reader.readAsDataURL(profilePictureFile);
         } else if (profilePictureFile === null && !isEditing) {
              setProfilePicturePreview(null); // Clear preview if file removed for new user
         } else if (profilePictureFile === null && isEditing && userData?.profile_picture_url) {
              setProfilePicturePreview(userData.profile_picture_url); // Revert preview if file removed during edit
         }
     }, [profilePictureFile, isEditing, userData]);


    const mutationFn = (formData) => {
        if (isEditing) {
            // Need to send PATCH, not POST with ID in URL for update
            return adminService.updateUser(userData.id, formData);
        } else {
            return adminService.createUser(formData);
        }
    };

    const mutation = useMutation(mutationFn, {
        onSuccess: () => {
            toast.success(isEditing ? 'Пользователь обновлен' : 'Пользователь создан');
            refetchUsers();
            onClose();
        },
        onError: (error) => {
             const errorMsg = error.response?.data;
             let readableError = "Ошибка сохранения.";
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
         console.log("Form Data Raw:", data);

         // Append fields, handling dates and files
         Object.keys(data).forEach(key => {
             if (key === 'profile_picture' && data[key] instanceof File) {
                 formData.append(key, data[key]);
             } else if (key === 'hire_date' && data[key]) {
                 formData.append(key, dayjs(data[key]).format('YYYY-MM-DD'));
             } else if (key === 'role_id' && !data[key]) {
                 // Don't append empty role_id if it's not selected
                 // Backend handles null role if needed
             } else if (key !== 'profile_picture' && key !== 'password2' && data[key] !== null && data[key] !== undefined) {
                  // Append booleans correctly
                 if (typeof data[key] === 'boolean') {
                      formData.append(key, data[key] ? 'true' : 'false');
                 } else {
                      formData.append(key, data[key]);
                 }
             }
         });

          // Only append password if it's being set/changed
         if (!isEditing || (isEditing && data.password)) {
             if (data.password) formData.append('password', data.password);
         } else {
              // If editing and password fields are empty, don't send them
             formData.delete('password');
         }


         console.log("FormData Content:");
         for (let pair of formData.entries()) {
              console.log(pair[0]+ ', ' + pair[1]);
          }

         mutation.mutate(formData);
    };

    const handleFileChange = (event) => {
         const file = event.target.files[0];
         if (file) {
             setValue('profile_picture', file, { shouldValidate: true, shouldDirty: true });
         }
     };


    const roles = rolesData?.results || [];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isEditing ? 'Редактировать пользователя' : 'Добавить пользователя'}</DialogTitle>
            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    {(rolesLoading || isSubmitting || mutation.isLoading) && <CircularProgress sx={{position: 'absolute', top: 70, left: '50%'}}/>}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        {/* Personal Info */}
                         <Grid item xs={12} container spacing={2}>
                              <Grid item xs={12} sm={2} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                   <Avatar src={profilePicturePreview || ''} sx={{ width: 80, height: 80, mb: 1 }} />
                                   <Button size="small" component="label" variant="outlined" sx={{fontSize: '0.7rem'}}>
                                        Фото
                                       <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                                   </Button>
                              </Grid>
                              <Grid item xs={12} sm={10} container spacing={2}>
                                  <Grid item xs={12} sm={4}>
                                      <Controller name="last_name" control={control} rules={{ required: 'Фамилия обязательна' }}
                                          render={({ field }) => <TextField {...field} label="Фамилия" fullWidth required error={!!errors.last_name} helperText={errors.last_name?.message} />}
                                      />
                                  </Grid>
                                  <Grid item xs={12} sm={4}>
                                      <Controller name="first_name" control={control} rules={{ required: 'Имя обязательно' }}
                                          render={({ field }) => <TextField {...field} label="Имя" fullWidth required error={!!errors.first_name} helperText={errors.first_name?.message} />}
                                      />
                                  </Grid>
                                  <Grid item xs={12} sm={4}>
                                      <Controller name="patronymic" control={control}
                                          render={({ field }) => <TextField {...field} label="Отчество" fullWidth />}
                                      />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                      <Controller name="email" control={control} rules={{ required: 'Email обязателен', pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: "Неверный формат email" } }}
                                          render={({ field }) => <TextField {...field} label="Email" type="email" fullWidth required error={!!errors.email} helperText={errors.email?.message} />}
                                      />
                                  </Grid>
                                   <Grid item xs={12} sm={6}>
                                        <Controller name="phone_number" control={control}
                                            render={({ field }) => <TextField {...field} label="Телефон" fullWidth />}
                                        />
                                   </Grid>
                               </Grid>
                         </Grid>

                         <Grid item xs={12}><Typography variant="subtitle1" sx={{mt: 1}}>Рабочая информация</Typography></Grid>

                        {/* Work Info */}
                        <Grid item xs={12} sm={6}>
                            <Controller name="role_id" control={control}
                                render={({ field }) => (
                                    <TextField {...field} select label="Роль" fullWidth error={!!errors.role_id} helperText={errors.role_id?.message}>
                                         <MenuItem value=""><em>-- Не назначена --</em></MenuItem>
                                        {roles.map(role => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
                                    </TextField>
                                )}
                            />
                        </Grid>
                         <Grid item xs={12} sm={6}>
                            <Controller name="employee_id" control={control}
                                render={({ field }) => <TextField {...field} label="Таб. номер" fullWidth />}
                            />
                         </Grid>
                         <Grid item xs={12} sm={6}>
                             <Controller name="position" control={control}
                                 render={({ field }) => <TextField {...field} label="Должность" fullWidth />}
                             />
                         </Grid>
                         <Grid item xs={12} sm={6}>
                             <Controller name="department" control={control}
                                 render={({ field }) => <TextField {...field} label="Подразделение" fullWidth />}
                             />
                         </Grid>
                          <Grid item xs={12} sm={6}>
                              <Controller name="shift" control={control}
                                  render={({ field }) => <TextField {...field} label="Смена" fullWidth />}
                              />
                          </Grid>
                         <Grid item xs={12} sm={6}>
                              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
                                  <Controller name="hire_date" control={control}
                                      render={({ field }) => <DatePicker {...field} label="Дата приема" format="DD.MM.YYYY" slotProps={{ textField: { fullWidth: true, error: !!errors.hire_date, helperText: errors.hire_date?.message } }} />}
                                  />
                              </LocalizationProvider>
                          </Grid>

                          <Grid item xs={12}><Typography variant="subtitle1" sx={{mt: 1}}>Доступ и Статус</Typography></Grid>

                          {/* Password - only required for new users, optional for edit */}
                           <Grid item xs={12} sm={6}>
                                <Controller name="password" control={control} rules={{ required: !isEditing ? 'Пароль обязателен' : false, minLength: isEditing && watch('password') ? { value: 8, message: 'Пароль должен быть минимум 8 символов' } : undefined }}
                                    render={({ field }) => <TextField {...field} label={isEditing ? "Новый пароль (если нужно)" : "Пароль"} type="password" fullWidth required={!isEditing} error={!!errors.password} helperText={errors.password?.message} />}
                                />
                            </Grid>
                           <Grid item xs={12} sm={6}>
                                <Controller name="password2" control={control} rules={{ validate: value => value === watch('password') || 'Пароли не совпадают' }}
                                    render={({ field }) => <TextField {...field} label="Подтвердите пароль" type="password" fullWidth required={!isEditing || !!watch('password')} error={!!errors.password2} helperText={errors.password2?.message} disabled={!watch('password') && isEditing} />}
                                />
                            </Grid>

                           {/* Status flags - only controllable by admin, not for superuser */}
                           <Grid item xs={12} sm={6}>
                               <Controller
                                   name="is_active"
                                   control={control}
                                   render={({ field }) => (
                                       <FormControlLabel
                                           control={<Switch {...field} checked={field.value} disabled={!!userData?.is_superuser}/>}
                                           label="Активен"
                                        />
                                   )}
                               />
                           </Grid>
                           <Grid item xs={12} sm={6}>
                                <Controller
                                    name="is_staff"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControlLabel
                                            control={<Switch {...field} checked={field.value} disabled={!!userData?.is_superuser}/>}
                                            label="Администратор (Персонал)"
                                         />
                                    )}
                                />
                           </Grid>

                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Отмена</Button>
                    <Button type="submit" variant="contained" disabled={isSubmitting || mutation.isLoading || rolesLoading}>
                         {isSubmitting || mutation.isLoading ? <CircularProgress size={24} /> : (isEditing ? 'Сохранить' : 'Создать')}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default UserForm;



