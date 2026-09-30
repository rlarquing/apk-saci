/**
 * Pantalla de Recuperar Contraseña
 * Flujo de 2 pasos: 1) Solicitar código por email 2) Ingresar código + nueva contraseña
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetwork } from '@/src/presentation/hooks/useNetwork';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { COLORS } from '@/src/shared/constants';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { isConnected } = useNetwork();

  // Step 1: Email
  const [email, setEmail] = useState('');
  // Step 2: Code + passwords
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[A-Z]/.test(pwd)) return 'La contraseña debe tener al menos 1 mayúscula';
    if (!/[a-z]/.test(pwd)) return 'La contraseña debe tener al menos 1 minúscula';
    if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(pwd)) return 'La contraseña debe tener al menos 1 dígito o carácter especial';
    return null;
  };

  const handleRequestReset = async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Esta función requiere conexión a internet');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingrese su correo electrónico');
      return;
    }

    setIsLoading(true);
    try {
      const result = await serviceContainer.auth.requestResetPassword(email.trim());
      if (result.successStatus) {
        Alert.alert('Código enviado', 'Se ha enviado un código de recuperación a su correo electrónico');
        setStep(2);
      } else {
        Alert.alert('Error', result.message || 'No se pudo enviar el código de recuperación');
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al solicitar recuperación de contraseña';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Esta función requiere conexión a internet');
      return;
    }

    if (!resetCode.trim()) {
      Alert.alert('Error', 'Por favor ingrese el código de recuperación');
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Por favor complete todos los campos');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert('Contraseña inválida', passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      const code = parseInt(resetCode.trim(), 10);
      if (isNaN(code)) {
        Alert.alert('Error', 'El código de recuperación debe ser un número');
        setIsLoading(false);
        return;
      }

      const result = await serviceContainer.auth.resetPassword(code, newPassword, confirmPassword);
      if (result.successStatus) {
        Alert.alert(
          'Contraseña restablecida',
          'Su contraseña ha sido restablecida exitosamente. Puede iniciar sesión con su nueva contraseña.',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
      } else {
        Alert.alert('Error', result.message || 'No se pudo restablecer la contraseña');
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al restablecer la contraseña';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="lock-reset" size={48} color={COLORS.accent} />
          <Text style={styles.title}>Recuperar Contraseña</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Ingrese su correo electrónico para recibir un código de recuperación'
              : 'Ingrese el código recibido y su nueva contraseña'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {step === 1 ? (
            <>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="email-outline" size={18} color={COLORS.lightGray} />
                  <Text style={styles.label}>Correo electrónico</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={COLORS.gray}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              {/* Send Code Button */}
              <TouchableOpacity
                style={[styles.actionButton, isLoading && styles.actionButtonDisabled]}
                onPress={handleRequestReset}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <View style={styles.actionButtonContent}>
                    <MaterialCommunityIcons name="send" size={22} color={COLORS.white} />
                    <Text style={styles.actionButtonText}>Enviar Código</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Reset Code Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="numeric" size={18} color={COLORS.lightGray} />
                  <Text style={styles.label}>Código de recuperación</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="Ingrese el código recibido"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="number-pad"
                />
              </View>

              {/* New Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="lock" size={18} color={COLORS.lightGray} />
                  <Text style={styles.label}>Nueva contraseña</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <MaterialCommunityIcons
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color={COLORS.accent}
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="lock-check" size={18} color={COLORS.lightGray} />
                  <Text style={styles.label}>Confirmar contraseña</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repita la contraseña"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <MaterialCommunityIcons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color={COLORS.accent}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Requirements */}
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>Requisitos de la contraseña:</Text>
                <Text style={styles.requirementText}>• Mínimo 8 caracteres</Text>
                <Text style={styles.requirementText}>• Al menos 1 letra mayúscula</Text>
                <Text style={styles.requirementText}>• Al menos 1 letra minúscula</Text>
                <Text style={styles.requirementText}>• Al menos 1 dígito o carácter especial</Text>
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                style={[styles.actionButton, isLoading && styles.actionButtonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <View style={styles.actionButtonContent}>
                    <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.white} />
                    <Text style={styles.actionButtonText}>Restablecer</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Back to step 1 */}
              <TouchableOpacity
                style={styles.backLink}
                onPress={() => setStep(1)}
              >
                <MaterialCommunityIcons name="arrow-left" size={18} color={COLORS.accent} />
                <Text style={styles.backLinkText}>Volver a ingresar email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Back to login */}
        <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/login')}>
          <MaterialCommunityIcons name="login" size={18} color={COLORS.gray} />
          <Text style={styles.loginLinkText}>Volver al inicio de sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 15,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.lightGray,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    padding: 25,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: COLORS.lightGray,
  },
  input: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  showPasswordButton: {
    position: 'absolute',
    right: 15,
    top: 38,
    padding: 4,
  },
  requirementsContainer: {
    backgroundColor: 'rgba(108, 153, 204, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  requirementsTitle: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  requirementText: {
    color: COLORS.lightGray,
    fontSize: 12,
    lineHeight: 18,
  },
  actionButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 5,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    gap: 6,
  },
  backLinkText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    gap: 6,
  },
  loginLinkText: {
    color: COLORS.gray,
    fontSize: 14,
  },
});
