import React from 'react';
import { Typography, Box } from '@mui/material';

const PageTitle = ({ title, subtitle, children }) => {
    return (
        <Box mb={3}>
            <Typography variant="h4" component="h1" gutterBottom>
                {title}
            </Typography>
            {subtitle && (
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    {subtitle}
                </Typography>
            )}
             {children && <Box mt={2}>{children}</Box>}
        </Box>
    );
};

export default PageTitle;


