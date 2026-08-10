import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Container, Grid, Paper, Typography, TextField, Button, Box, Avatar, IconButton, CircularProgress, Alert } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import PageTitle from '../components/Common/PageTitle';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import authService from '../services/authService';
import { checkAuth } from '../store/slices/authSlice'; // To refresh user data in store

const ProfilePage = () => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { user, status: authStatus } = useSelector((state) => state.auth);
    const [profilePicturePreview, setProfilePicturePreview] = useState(null);
    const [isEditing, setIsEditing] = useState(false); // State for edit mode

    const { control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm({
        defaultValues: {
            first_name: '',
            last_name: '',
            patronymic: '',
            email: '',
            phone_number: '',
            profile_picture: null, // Field for file upload
        }
    });

    const { mutate: updateProfileMutate, isLoading: isUpdating, error: updateError } = useMutation(authService.updateProfile, {
        onSuccess: (data) => {
            toast.success('Профиль успешно обновлен!');
            setIsEditing(false); // Exit edit mode
             // Invalidate queries or update cache if needed
             // queryClient.invalidateQueries('profile');
            dispatch(checkAuth()); // Refresh user data in Redux store
            reset(mapUserDataToForm(data)); // Reset form with new data
            setProfilePicturePreview(null); // Clear preview after saving
        },
        onError: (error) => {
            toast.error(`Ошибка обновления профиля: ${error.response?.data?.detail || error.message}`);
        }
    });

     // Populate form when user data is available or changes
    useEffect(() => {
        if (user) {
             reset(mapUserDataToForm(user));
             setProfilePicturePreview(null); // Reset preview on user change
        }
    }, [user, reset]);

     // Helper to map user data for the form
     const mapUserDataToForm = (userData) => ({
          first_name: userData?.first_name || '',
          last_name: userData?.last_name || '',
          patronymic: userData?.patronymic || '',
          email: userData?.email || '',
          phone_number: userData?.phone_number || '',
          profile_picture: null, // Reset file input on data load
     });


    const onSubmit = (data) => {
        // Create FormData only if editing profile picture or other fields
        const formData = new FormData();
         let hasChanges = false;

         Object.keys(data).forEach(key => {
             // Check if value changed from original user data OR if it's the profile picture file
             if (key === 'profile_picture' && data[key] instanceof File) {
                 formData.append(key, data[key]);
                 hasChanges = true;
             } else if (key !== 'profile_picture' && data[key] !== (user?.[key] || '')) {
                 formData.append(key, data[key] ?? ''); // Send empty string if null/undefined
                 hasChanges = true;
             }
         });

         // Only submit if there are actual changes
         if (hasChanges) {
             updateProfileMutate(formData);
         } else {
              setIsEditing(false); // Exit edit mode if no changes
             toast.info("Нет изменений для сохранения.");
         }
    };

     const handleEditToggle = () => {
         setIsEditing(!isEditing);
         if (isEditing && user) {
              // If cancelling edit, reset form to original user data
             reset(mapUserDataToForm(user));
             setProfilePicturePreview(null);
         }
     };

    const handlePictureChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setValue('profile_picture', file, { shouldDirty: true }); // Set file and mark form as dirty
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePicturePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    if (authStatus === 'loading' || !user) {
        return <LoadingSpinner />;
    }

    const currentPictureUrl = profilePicturePreview || user?.profile_picture_url;

    return (
        <Container maxWidth="lg">
            <PageTitle title="Мой профиль" />
            <Paper sx={{ p: 3 }}>
                 {updateError && (
                     <Alert severity="error" sx={{ mb: 2 }}>
                         {updateError.response?.data?.detail || updateError.message || 'Произошла ошибка'}
                     </Alert>
                 )}
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Avatar
                                src={currentPictureUrl}
                                sx={{ width: 150, height: 150, mb: 2 }}
                             >
                                 {/* Fallback avatar */}
                                 {!currentPictureUrl && user?.first_name && user.first_name.charAt(0).toUpperCase()}
                             </Avatar>
                             {isEditing && (
                                 <>
                                     <input
                                         accept="image/*"
                                         style={{ display: 'none' }}
                                         id="icon-button-file"
                                         type="file"
                                         onChange={handlePictureChange}
                                     />
                                     <label htmlFor="icon-button-file">
                                         <Button variant="outlined" component="span" startIcon={<PhotoCamera />}>
                                             Загрузить фото
                                         </Button>
                                     </label>
                                </>
                             )}
                             <Typography variant="h6" sx={{ mt: 2 }}>{user.get_full_name}</Typography>
                             <Typography color="text.secondary">{user.position}</Typography>
                             <Typography color="text.secondary">{user.department}</Typography>
                        </Grid>
                        <Grid item xs={12} md={8}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Controller
                                        name="last_name"
                                        control={control}
                                        rules={{ required: 'Фамилия обязательна' }}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                label="Фамилия"
                                                fullWidth
                                                required
                                                error={!!errors.last_name}
                                                helperText={errors.last_name?.message}
                                                disabled={!isEditing}
                                            />
                                        )}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                     <Controller
                                        name="first_name"
                                        control={control}
                                        rules={{ required: 'Имя обязательно' }}
                                        render={({ field }) => (
                                             <TextField
                                                 {...field}
                                                 label="Имя"
                                                 fullWidth
                                                 required
                                                 error={!!errors.first_name}
                                                 helperText={errors.first_name?.message}
                                                 disabled={!isEditing}
                                             />
                                         )}
                                     />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Controller
                                        name="patronymic"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                label="Отчество"
                                                fullWidth
                                                disabled={!isEditing}
                                            />
                                        )}
                                    />
                                </Grid>
                                 <Grid item xs={12} sm={6}>
                                    <Controller
                                         name="phone_number"
                                         control={control}
                                         render={({ field }) => (
                                             <TextField
                                                 {...field}
                                                 label="Номер телефона"
                                                 fullWidth
                                                 disabled={!isEditing}
                                             />
                                         )}
                                     />
                                 </Grid>
                                <Grid item xs={12}>
                                     <Controller
                                        name="email"
                                        control={control}
                                        rules={{ required: 'Email обязателен' }}
                                        render={({ field }) => (
                                             <TextField
                                                 {...field}
                                                 label="Электронная почта"
                                                 type="email"
                                                 fullWidth
                                                 required
                                                 error={!!errors.email}
                                                 helperText={errors.email?.message}
                                                 disabled // Email usually not editable by user
                                             />
                                         )}
                                     />
                                </Grid>
                                {/* Display only fields */}
                                 <Grid item xs={12} sm={6}>
                                     <TextField label="Должность" value={user.position || '-'} fullWidth InputProps={{ readOnly: true }} />
                                 </Grid>
                                 <Grid item xs={12} sm={6}>
                                     <TextField label="Подразделение" value={user.department || '-'} fullWidth InputProps={{ readOnly: true }} />
                                 </Grid>
                                  <Grid item xs={12} sm={6}>
                                      <TextField label="Таб. номер" value={user.employee_id || '-'} fullWidth InputProps={{ readOnly: true }}/>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                       <TextField label="Дата приема" value={user.hire_date || '-'} fullWidth InputProps={{ readOnly: true }}/>
                                  </Grid>
                            </Grid>
                             <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                {isEditing ? (
                                    <>
                                        <Button onClick={handleEditToggle} sx={{ mr: 1 }} disabled={isUpdating}>
                                            Отмена
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={isUpdating || !isDirty}
                                         >
                                             {isUpdating ? <CircularProgress size={24} color="inherit"/> : 'Сохранить изменения'}
                                        </Button>
                                    </>
                                 ) : (
                                     <Button variant="contained" onClick={handleEditToggle}>
                                         Редактировать профиль
                                     </Button>
                                 )}
                             </Box>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

             {/* TODO: Add Change Password section */}
             <Paper sx={{ p: 3, mt: 3 }}>
                  <Typography variant="h6" gutterBottom>Изменение пароля</Typography>
                  {/* Add ChangePasswordForm component here */}
                   <Typography color="text.secondary">Раздел изменения пароля в разработке.</Typography>
             </Paper>
        </Container>
    );
};

export default ProfilePage;


