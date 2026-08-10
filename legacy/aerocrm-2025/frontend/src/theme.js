import { createTheme } from '@mui/material/styles';
import { ruRU } from '@mui/material/locale';
import { ruRU as dataGridRuRU } from '@mui/x-data-grid/locales'; // If using DataGrid
import { ruRU as datePickersRuRU } from '@mui/x-date-pickers/locales';


const theme = createTheme(
  {
    palette: {
      primary: {
        main: '#1976d2', // Example blue
      },
      secondary: {
        main: '#dc004e', // Example pink
      },
      background: {
        default: '#f4f6f8',
        paper: '#ffffff',
      },
    },
    typography: {
      fontFamily: 'Roboto, Arial, sans-serif',
      h1: { fontSize: '2.2rem', fontWeight: 500 },
      h2: { fontSize: '1.8rem', fontWeight: 500 },
      h3: { fontSize: '1.5rem', fontWeight: 500 },
      h4: { fontSize: '1.3rem', fontWeight: 500 },
      h5: { fontSize: '1.1rem', fontWeight: 500 },
      h6: { fontSize: '1rem', fontWeight: 500 },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: '1px solid #e0e0e0'
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
             borderRight: '1px solid #e0e0e0'
          }
        }
      },
      MuiButton: {
         styleOverrides: {
             root: {
                 textTransform: 'none', // More standard button text
             }
         }
      },
       MuiTextField: {
            defaultProps: {
                variant: 'outlined',
                size: 'small',
                margin: 'dense',
            },
        },
        MuiFormControl: {
             defaultProps: {
                 variant: 'outlined',
                 size: 'small',
                 margin: 'dense',
             },
         },
    },
  },
  ruRU, // Locale for Core components
  datePickersRuRU, // Locale for Date Pickers
  // dataGridRuRU // Locale for Data Grid (Uncomment if you use DataGrid)
);

export default theme;


