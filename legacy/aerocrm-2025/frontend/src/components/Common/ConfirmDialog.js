import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Box, Typography } from '@mui/material';

const ConfirmDialog = ({ open, onClose, onConfirm, title, children, isLoading = false, confirmText = "Подтвердить", cancelText = "Отмена", confirmColor = "primary" }) => {
    return (
        <Dialog open={open} onClose={onClose} aria-labelledby="confirm-dialog-title">
            <DialogTitle id="confirm-dialog-title">{title || "Подтверждение действия"}</DialogTitle>
            <DialogContent>
                {children || <Typography>Вы уверены, что хотите выполнить это действие?</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isLoading}>
                    {cancelText}
                </Button>
                <Button onClick={onConfirm} color={confirmColor} variant="contained" disabled={isLoading}>
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;

