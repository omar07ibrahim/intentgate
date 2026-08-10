import React from 'react';
import { Container } from '@mui/material';
import PageTitle from '../../components/Common/PageTitle';
import AuditLogTable from '../../components/Admin/AuditLogTable'; // Create this component

const AdminAuditLogPage = () => {
    return (
        <Container maxWidth="xl">
            <PageTitle title="Журнал аудита действий" />
            <AuditLogTable />
        </Container>
    );
};

export default AdminAuditLogPage;


