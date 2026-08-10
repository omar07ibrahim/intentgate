import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, TextField, Button, Grid, MenuItem, CircularProgress, Box, Typography } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import PageTitle from '../components/Common/PageTitle';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import leaveService from '../services/leaveService';

const LeaveRequestPage = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            leave_type_id: '',
            start_date: null,
            end_date: null,
            reason: '',
        }
    });

    const { data: leaveTypes, isLoading: typesLoading } = useQuery(
        'leaveTypes',
        leaveService.getLeaveTypes
    );

    const mutation = useMutation(leaveService.requestLeave, {
        onSuccess: () => {
            toast.success('Запрос на отсутствие успешно отправлен.');
            queryClient.invalidateQueries('leaveRecords'); // Invalidate leave list
            reset(); // Reset form
            navigate('/leaves/history'); // Redirect to history page
        },
        onError: (error) => {
            const errorMsg = error.response?.data;
             let readableError = "Ошибка отправки запроса.";
             if (typeof errorMsg === 'string') {
                 readableError = errorMsg;
             } else if (Array.isArray(errorMsg) && errorMsg.length > 0) {
                  readableError = errorMsg[0]; // Take first error string
             } else if (typeof errorMsg === 'object' && errorMsg !== null) {
                 const firstErrorKey = Object.keys(errorMsg)[0];
                  if (firstErrorKey && Array.isArray(errorMsg[firstErrorKey])) {
                       readableError = `${firstErrorKey}: ${errorMsg[firstErrorKey][0]}`;
                  } else if (firstErrorKey === 'non_field_errors' && Array.isArray(errorMsg[firstErrorKey])){
                       readableError = errorMsg[firstErrorKey][0]; // Handle non_field_errors
                  }
                   else {
                       readableError = JSON.stringify(errorMsg); // Fallback
                  }
             }
             toast.error(`Ошибка: ${readableError}`);
        },
    });

    const onSubmit = (data) => {
        const payload = {
            ...data,
            start_date: dayjs(data.start_date).format('YYYY-MM-DD'),
            end_date: dayjs(data.end_date).format('YYYY-MM-DD'),
        };
        mutation.mutate(payload);
    };

    if (typesLoading) {
        return <LoadingSpinner />;
    }

    return (
        <Container maxWidth="md">
            <PageTitle title="Запрос на отпуск / Отсутствие" />
            <Paper sx={{ p: 3 }}>
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <Grid container spacing={3}>
                         <Grid item xs={12}>
                            <Controller
                                name="leave_type_id"
                                control={control}
                                rules={{ required: 'Выберите тип отсутствия' }}
                                render={({ field }) => (
                                     <TextField
                                         {...field}
                                         select
                                         label="Тип отсутствия"
                                         fullWidth
                                         required
                                         error={!!errors.leave_type_id}
                                         helperText={errors.leave_type_id?.message}
                                      >
                                         <MenuItem value=""><em>-- Выберите тип --</em></MenuItem>
                                         {leaveTypes?.results?.map((type) => ( // Handle potential pagination
                                             <MenuItem key={type.id} value={type.id}>
                                                 {type.name} {type.is_vacation ? '(Отпуск)' : ''} {type.is_paid ? '' : '(Неоплач.)'}
                                             </MenuItem>
                                         ))}
                                         {/* Handle non-paginated list */}
                                         {Array.isArray(leaveTypes) && leaveTypes.map((type) => (
                                              <MenuItem key={type.id} value={type.id}>
                                                   {type.name} {type.is_vacation ? '(Отпуск)' : ''} {type.is_paid ? '' : '(Неоплач.)'}
                                              </MenuItem>
                                          ))}
                                     </TextField>
                                 )}
                             />
                        </Grid>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="start_date"
                                    control={control}
                                    rules={{ required: 'Дата начала обязательна' }}
                                    render={({ field }) => (
                                        <DatePicker
                                             {...field}
                                             label="Дата начала *"
                                             format="DD.MM.YYYY"
                                             minDate={dayjs()} // Prevent selecting past dates
                                             slotProps={{ textField: { fullWidth: true, required: true, error: !!errors.start_date, helperText: errors.start_date?.message } }}
                                         />
                                     )}
                                 />
                             </Grid>
                            <Grid item xs={12} sm={6}>
                                 <Controller
                                     name="end_date"
                                     control={control}
                                     rules={{
                                          required: 'Дата окончания обязательна',
                                          validate: (value, formValues) => dayjs(value).isAfter(dayjs(formValues.start_date)) || dayjs(value).isSame(dayjs(formValues.start_date)) || 'Дата окончания должна быть не раньше даты начала'
                                      }}
                                     render={({ field }) => (
                                         <DatePicker
                                             {...field}
                                             label="Дата окончания *"
                                             format="DD.MM.YYYY"
                                             minDate={control._formValues.start_date || dayjs()} // Min date depends on start date
                                             slotProps={{ textField: { fullWidth: true, required: true, error: !!errors.end_date, helperText: errors.end_date?.message } }}
                                         />
                                     )}
                                 />
                             </Grid>
                         </LocalizationProvider>
                         <Grid item xs={12}>
                             <Controller
                                 name="reason"
                                 control={control}
                                 render={({ field }) => (
                                      <TextField
                                          {...field}
                                          label="Причина / Комментарий (необязательно)"
                                          fullWidth
                                          multiline
                                          rows={4}
                                      />
                                  )}
                             />
                        </Grid>
                        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                             <Button
                                 type="submit"
                                 variant="contained"
                                 disabled={isSubmitting || mutation.isLoading}
                             >
                                  {isSubmitting || mutation.isLoading ? <CircularProgress size={24} /> : 'Отправить запрос'}
                             </Button>
                         </Grid>
                    </Grid>
                </Box>
            </Paper>
        </Container>
    );
};

export default LeaveRequestPage;


