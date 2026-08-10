import React from 'react';
import { Container } from '@mui/material';
import PageTitle from '../../components/Common/PageTitle';
import LeaveManagementTable from '../../components/Admin/LeaveManagementTable'; // Create this component

const AdminLeaveMgmtPage = () => {
    return (
        <Container maxWidth="xl">
            <PageTitle title="Управление отсутствиями сотрудников" />
            <LeaveManagementTable />
        </Container>
    );
};

export default AdminLeaveMgmtPage;


