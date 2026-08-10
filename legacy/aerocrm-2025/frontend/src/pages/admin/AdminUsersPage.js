import React from 'react';
import { Container } from '@mui/material';
import PageTitle from '../../components/Common/PageTitle';
import UsersTable from '../../components/Admin/UsersTable'; // Create this component

const AdminUsersPage = () => {
    return (
        <Container maxWidth="xl">
            <PageTitle title="Управление пользователями" />
            <UsersTable />
        </Container>
    );
};

export default AdminUsersPage;


