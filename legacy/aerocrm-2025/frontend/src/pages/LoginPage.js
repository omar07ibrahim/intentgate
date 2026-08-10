import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginUser, resetAuthStatus } from '../store/slices/authSlice';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';

import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, error } = useSelector((state) => state.auth);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const from = location.state?.from?.pathname || "/"; // Redirect path after login

  useEffect(() => {
    // Reset error state when component mounts or unmounts
    dispatch(resetAuthStatus());
    return () => {
      dispatch(resetAuthStatus());
    };
  }, [dispatch]);

  const onSubmit = (data) => {
    dispatch(loginUser(data))
      .unwrap() // Allows catching rejection in component
      .then(() => {
        toast.success('Вход выполнен успешно!');
        navigate(from, { replace: true });
      })
      .catch((loginError) => {
         // Error is already in redux state, toast is optional
         toast.error(loginError || 'Ошибка входа. Проверьте данные.');
      });
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Вход в AeroCRM
        </Typography>
        {error && status === 'failed' && (
          <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Электронная почта"
            name="email"
            autoComplete="email"
            autoFocus
            {...register("email", {
                required: "Электронная почта обязательна",
                pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Неверный формат email"
                }
             })}
             error={!!errors.email}
             helperText={errors.email?.message}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Пароль"
            type="password"
            id="password"
            autoComplete="current-password"
             {...register("password", { required: "Пароль обязателен" })}
             error={!!errors.password}
             helperText={errors.password?.message}
          />
          {/* Add Remember me or Forgot password later if needed */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? <CircularProgress size={24} color="inherit" /> : 'Войти'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LoginPage;


