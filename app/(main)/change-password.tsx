/**
 * Pantalla de Cambiar Contraseña
 * Usuario autenticado - requiere conexión a internet
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

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { isConnected } = useNetwork();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[A-Z]/.test(pwd)) return 'La contraseña debe tener al menos 1 mayúscula';
    if (!/[a-z]/.test(pwd)) return 'La contraseña debe tener al menos 1 minúscula';
    if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(pwd)) return 'La contraseña debe tener al menos 1 dígito o carácter especial';
    return null;
  };

  const handleChangePassword = async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Esta función requiere conexión a internet');
      return;
    }

    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
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

    if (oldPassword === newPassword) {
      Alert.alert('Error', 'La nueva contraseña debe ser diferente a la actual');
      return;
    }

    setIsLoading(true);
    try {
      const result = await serviceContainer.auth.changePassword(oldPassword, newPassword, confirmPassword);
      if (result.successStatus) {
        Alert.alert(
          'Contraseña actualizada',
          'Su contraseña ha sido cambiada exitosamente.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', result.message || 'No se pudo cambiar la contraseña');
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al cambiar la contraseña';
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
          <MaterialCommunityIcons name="shield-key" size={48} color={COLORS.accent} />
          <Text style={styles.title}>Cambiar Contraseña</Text>
          <Text style={styles.subtitle}>Actualice su contraseña de acceso</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Old Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputLabelRow}>
              <MaterialCommunityIcons name="lock" size={18} color={COLORS.lightGray} />
              <Text style={styles.label}>Contraseña actual</Text>
            </View>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Ingrese su contraseña actual"
              placeholderTextColor={COLORS.gray}
              secureTextEntry={!showOldPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowOldPassword(!showOldPassword)}
            >
              <MaterialCommunityIcons
                name={showOldPassword ? 'eye-off' : 'eye'}
                size={22}
                color={COLORS.accent}
              />
            </TouchableOpacity>
          </View>

          {/* New Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputLabelRow}>
              <MaterialCommunityIcons name="lock-plus" size={18} color={COLORS.lightGray} />
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
              <Text style={styles.label}>Confirmar nueva contraseña</Text>
            </View>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repita la nueva contraseña"
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

          {/* Change Button */}
          <TouchableOpacity
            style={[styles.actionButton, isLoading && styles.actionButtonDisabled]}
            onPress={handleChangePassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <View style={styles.actionButtonContent}>
                <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Cambiar Contraseña</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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
});
