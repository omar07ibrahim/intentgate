import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid, MenuItem, CircularProgress, Box, Typography, IconButton } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/ru'; // Import Russian locale for Dayjs
import documentService from '../../services/documentService';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ClearIcon from '@mui/icons-material/Clear';

const PersonalDocForm = ({ open, onClose, documentData, refetchDocs }) => {
    const queryClient = useQueryClient();
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const isEditing = !!documentData;

    const { data: docTypesData, isLoading: docTypesLoading } = useQuery(
         'personalDocTypes',
         () => documentService.getDocumentTypes({ is_personal: true, page_size: 1000 }), // Fetch only personal types, assume less than 1000
         { enabled: open } // Fetch only when dialog is open
    );

    const { control, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            document_type_id: '',
            document_number: '',
            issue_date: null,
            expiry_date: null,
            uploaded_file: null,
            notes: '',
        }
    });

    // Watch file input for changes
    const uploadedFileValue = watch('uploaded_file');

    useEffect(() => {
         if (open) {
             if (isEditing && documentData) {
                 reset({
                     document_type_id: documentData.document_type?.id || '',
                     document_number: documentData.document_number || '',
                     issue_date: documentData.issue_date ? dayjs(documentData.issue_date) : null,
                     expiry_date: documentData.expiry_date ? dayjs(documentData.expiry_date) : null,
                     uploaded_file: null, // Don't prefill file input
                     notes: documentData.notes || '',
                 });
                 setFileName(documentData.uploaded_file_url ? documentData.uploaded_file_url.split('/').pop() : ''); // Show existing file name
                 setSelectedFile(null); // Reset preview/new file state
             } else {
                 // Reset form for new entry
                 reset({
                     document_type_id: '',
                     document_number: '',
                     issue_date: null,
                     expiry_date: null,
                     uploaded_file: null,
                     notes: '',
                 });
                 setFileName('');
                 setSelectedFile(null);
             }
         }
    }, [open, documentData, isEditing, reset]);

    useEffect(() => {
         // Update fileName state when RHF file input changes
        if (uploadedFileValue instanceof File) {
             setFileName(uploadedFileValue.name);
         } else if (uploadedFileValue === null && !isEditing) {
             setFileName(''); // Clear if file is removed (and not editing existing)
         } else if (uploadedFileValue === null && isEditing && documentData?.uploaded_file_url) {
              setFileName(documentData.uploaded_file_url.split('/').pop()); // Revert to original name if cleared during edit
         }
    }, [uploadedFileValue, isEditing, documentData]);


    const mutation = useMutation(
        (formData) => isEditing ? documentService.updatePersonalDocument(documentData.id, formData) : documentService.uploadPersonalDocument(formData),
        {
            onSuccess: () => {
                toast.success(isEditing ? 'Документ обновлен' : 'Документ добавлен');
                refetchDocs(); // Invalidate query from parent
                onClose(); // Close dialog
            },
            onError: (error) => {
                 const errorMsg = error.response?.data;
                 let readableError = "Ошибка сохранения.";
                 if (typeof errorMsg === 'string') {
                     readableError = errorMsg;
                 } else if (typeof errorMsg === 'object' && errorMsg !== null) {
                      // Try to extract specific field errors
                      const firstErrorKey = Object.keys(errorMsg)[0];
                      if (firstErrorKey && Array.isArray(errorMsg[firstErrorKey])) {
                           readableError = `${firstErrorKey}: ${errorMsg[firstErrorKey][0]}`;
                      } else {
                           readableError = JSON.stringify(errorMsg); // Fallback
                      }
                 }
                toast.error(`Ошибка: ${readableError}`);
            },
        }
    );

    const onSubmit = (data) => {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (key === 'uploaded_file' && data[key] instanceof File) {
                 formData.append(key, data[key]);
             } else if (key === 'issue_date' || key === 'expiry_date') {
                 if (data[key]) {
                     formData.append(key, dayjs(data[key]).format('YYYY-MM-DD'));
                 }
             } else if (key !== 'uploaded_file' && data[key] !== null && data[key] !== undefined) {
                 formData.append(key, data[key]);
             }
        });

        mutation.mutate(formData);
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
             setValue('uploaded_file', file, { shouldValidate: true });
             // setSelectedFile(file); // This is handled by RHF now
             // setFileName(file.name); // This is handled by useEffect watching RHF field
        }
    };

     const handleRemoveFile = () => {
          setValue('uploaded_file', null, { shouldValidate: true });
          // setSelectedFile(null); // Handled by RHF
          // setFileName(''); // Handled by useEffect
          // Clear the actual file input visually (important)
          const fileInput = document.getElementById('personal-doc-file-input');
          if (fileInput) {
               fileInput.value = '';
          }
     };

    const docTypes = docTypesData?.results || [];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEditing ? 'Редактировать личный документ' : 'Добавить личный документ'}</DialogTitle>
            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    {docTypesLoading ? <CircularProgress /> : (
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={12}>
                                <Controller
                                    name="document_type_id"
                                    control={control}
                                    rules={{ required: 'Выберите тип документа' }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            label="Тип документа"
                                            fullWidth
                                            required
                                            error={!!errors.document_type_id}
                                            helperText={errors.document_type_id?.message}
                                        >
                                            <MenuItem value=""><em>-- Выберите тип --</em></MenuItem>
                                            {docTypes.map((type) => (
                                                <MenuItem key={type.id} value={type.id}>
                                                    {type.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="document_number"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} label="Номер документа" fullWidth />
                                    )}
                                />
                            </Grid>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
                                <Grid item xs={12} sm={6}>
                                    <Controller
                                        name="issue_date"
                                        control={control}
                                        render={({ field }) => (
                                             <DatePicker
                                                 {...field}
                                                 label="Дата выдачи"
                                                 format="DD.MM.YYYY"
                                                 slotProps={{ textField: { fullWidth: true, error: !!errors.issue_date, helperText: errors.issue_date?.message } }}
                                              />
                                         )}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Controller
                                        name="expiry_date"
                                        control={control}
                                        rules={{ required: 'Дата истечения обязательна' }}
                                        render={({ field }) => (
                                             <DatePicker
                                                 {...field}
                                                 label="Дата истечения *"
                                                 format="DD.MM.YYYY"
                                                 slotProps={{ textField: { fullWidth: true, required: true, error: !!errors.expiry_date, helperText: errors.expiry_date?.message } }}
                                              />
                                         )}
                                    />
                                </Grid>
                            </LocalizationProvider>
                             <Grid item xs={12}>
                                  <Controller
                                     name="notes"
                                     control={control}
                                     render={({ field }) => (
                                         <TextField
                                             {...field}
                                             label="Примечания"
                                             fullWidth
                                             multiline
                                             rows={3}
                                         />
                                     )}
                                 />
                             </Grid>
                             <Grid item xs={12}>
                                 <Typography variant="body2" gutterBottom>Скан-копия файла (необязательно):</Typography>
                                 <Box sx={{ display: 'flex', alignItems: 'center', border: '1px dashed grey', p: 1, borderRadius: 1 }}>
                                     <Button
                                         variant="outlined"
                                         component="label"
                                         size="small"
                                         startIcon={<UploadFileIcon />}
                                     >
                                         Выбрать файл
                                         <input
                                              id="personal-doc-file-input"
                                              type="file"
                                              hidden
                                              onChange={handleFileChange}
                                          />
                                     </Button>
                                     {fileName && (
                                         <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                                              <Typography variant="body2" noWrap sx={{ mr: 1 }}>{fileName}</Typography>
                                              <IconButton onClick={handleRemoveFile} size="small" title="Убрать файл">
                                                  <ClearIcon fontSize="small" />
                                              </IconButton>
                                         </Box>
                                      )}
                                 </Box>
                             </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Отмена</Button>
                    <Button type="submit" variant="contained" disabled={isSubmitting || mutation.isLoading}>
                         {isSubmitting || mutation.isLoading ? <CircularProgress size={24} /> : (isEditing ? 'Сохранить' : 'Добавить')}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default PersonalDocForm;


