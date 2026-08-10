import React from 'react';
import { Container } from '@mui/material';
import PageTitle from '../../components/Common/PageTitle';
import DocTypesTable from '../../components/Admin/DocTypesTable'; // Create this component

const AdminDocTypesPage = () => {
    return (
        <Container maxWidth="lg">
            <PageTitle title="Управление типами документов" />
            <DocTypesTable />
        </Container>
    );
};

export default AdminDocTypesPage;


