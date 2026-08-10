import React from 'react';
import { Container, Typography, Button, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

const NotFoundPage = () => {
    return (
        <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
            <ReportProblemIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom>
                404 - Страница не найдена
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Извините, страница, которую вы ищете, не существует.
            </Typography>
            <Button variant="contained" component={RouterLink} to="/">
                Вернуться на главную
            </Button>
        </Container>
    );
};

export default NotFoundPage;


