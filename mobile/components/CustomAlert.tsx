// components/CustomAlert.tsx
// Issue #10: Custom alert component matching overall app design
// Replaces native Alert.alert() for in-app confirmations

import React, { useEffect, useRef } from 'react';
import {
    Modal, View, Text, TouchableOpacity,
    StyleSheet, Animated, Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message?: string;
    icon?: string;
    buttons?: AlertButton[];
    onClose?: () => void;
}

const { width } = Dimensions.get('window');

const CustomAlert = React.memo(function CustomAlert({
    visible, title, message, icon, buttons = [], onClose,
}: CustomAlertProps) {
    const { theme } = useTheme();
    const scaleAnim = useRef(new Animated.Value(0.88)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, speed: 18, bounciness: 6, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scaleAnim, { toValue: 0.92, duration: 140, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    const defaultButtons: AlertButton[] = buttons.length > 0 ? buttons : [
        { text: 'OK', onPress: onClose, style: 'default' },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                <Animated.View style={[
                    styles.card,
                    {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}>
                    {/* Brand accent strip + handle — Request-screen sheet parity */}
                    <View style={styles.sheetTop}>
                        <View style={[styles.accentStrip, { backgroundColor: theme.primary }]} />
                        <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
                    </View>

                    {/* Icon */}
                    {icon && <Text style={styles.icon}>{icon}</Text>}

                    {/* Title */}
                    <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>

                    {/* Message */}
                    {message && (
                        <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
                    )}

                    {/* Divider */}
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    {/* Buttons */}
                    <View style={[
                        styles.buttons,
                        defaultButtons.length === 1 && styles.buttonsSingle,
                    ]}>
                        {defaultButtons.map((btn, i) => {
                            const isCancel = btn.style === 'cancel';
                            const isDestructive = btn.style === 'destructive';
                            const isLast = i === defaultButtons.length - 1;

                            const btnColor = isDestructive ? theme.primary
                                : isCancel ? theme.textMuted
                                    : theme.textPrimary;

                            return (
                                <React.Fragment key={btn.text}>
                                    {i > 0 && defaultButtons.length === 2 && (
                                        <View style={[styles.btnDividerV, { backgroundColor: theme.border }]} />
                                    )}
                                    <TouchableOpacity
                                        onPress={() => { btn.onPress?.(); onClose?.(); }}
                                        style={[
                                            styles.btn,
                                            isLast && defaultButtons.length > 2 && { borderBottomWidth: 0 },
                                            defaultButtons.length > 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                                        ]}
                                        activeOpacity={0.6}
                                    >
                                        <Text style={[
                                            styles.btnText,
                                            { color: btnColor },
                                            (isDestructive || (!isCancel && defaultButtons.length <= 2)) && styles.btnTextBold,
                                        ]}>
                                            {btn.text}
                                        </Text>
                                    </TouchableOpacity>
                                </React.Fragment>
                            );
                        })}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
});

const CARD_W = Math.min(width - Spacing[10] * 2, 320);

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing[10],
    },
    card: {
        width: CARD_W,
        borderRadius: Radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        alignItems: 'center',
        paddingTop: Spacing[6],
    },
    sheetTop:    { alignItems: 'center', paddingTop: Spacing[3], paddingBottom: Spacing[2] },
    accentStrip: { width: 36, height: 3, borderRadius: 2, marginBottom: Spacing[1], opacity: 0.9 },
    handle:      { width: 44, height: 4, borderRadius: 2 },
    icon: { fontSize: 40, marginBottom: Spacing[3] },
    title: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.black,
        letterSpacing: LetterSpacing.snug,
        textAlign: 'center',
        paddingHorizontal: Spacing[5],
        marginBottom: Spacing[2],
    },
    message: {
        fontSize: FontSize.sm,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing[5],
        marginBottom: Spacing[5],
    },
    divider: { width: '100%', height: StyleSheet.hairlineWidth },
    buttons: { flexDirection: 'row', width: '100%' },
    buttonsSingle: { flexDirection: 'column' },
    btn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing[4],
        paddingHorizontal: Spacing[3],
    },
    btnText: {
        fontSize: FontSize.base,
        fontWeight: FontWeight.medium,
    },
    btnTextBold: { fontWeight: FontWeight.black },
    btnDividerV: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});

export default CustomAlert;

// ── useCustomAlert hook — drop-in Alert.alert() replacement ──────────────────
import { useState, useCallback } from 'react';

interface AlertState {
    visible: boolean;
    title: string;
    message?: string;
    icon?: string;
    buttons: AlertButton[];
}

export function useCustomAlert() {
    const [alertState, setAlertState] = useState<AlertState>({
        visible: false, title: '', buttons: [],
    });

    const showAlert = useCallback((
        title: string,
        message?: string,
        buttons?: AlertButton[],
        icon?: string,
    ) => {
        setAlertState({ visible: true, title, message, buttons: buttons ?? [], icon });
    }, []);

    const hideAlert = useCallback(() => {
        setAlertState(prev => ({ ...prev, visible: false }));
    }, []);

    const AlertComponent = (
        <CustomAlert
            visible={alertState.visible}
            title={alertState.title}
            message={alertState.message}
            icon={alertState.icon}
            buttons={alertState.buttons}
            onClose={hideAlert}
        />
    );

    return { showAlert, hideAlert, AlertComponent };
}