/**
 * Pantalla de Login
 * Usa Clean Architecture con soporte offline-first
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
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
import { useAuth } from '@/src/presentation';
import { useNetwork } from '@/src/presentation/hooks/useNetwork';
import { COLORS } from '@/src/shared/constants';

export default function LoginScreen() {
  const router = useRouter();
  const { login, sesion, seleccionarAlmacen } = useAuth();
  const { isConnected, isServerReachable, checkConnection } = useNetwork();
  
const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor complete todos los campos');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password);
      
      // El AuthContext maneja la lógica de selección de almacen
      // La navegación se maneja en el _layout.tsx
      
} catch (error: any) {
      const errorMessage = error?.message || 'Credenciales inválidas';
      const isOfflineRelated = errorMessage.includes('sin conexión') || errorMessage.includes('timeout');
      const isAccesoDenegado = error?.name === 'AccesoMovilDenegadoError';

      if (isAccesoDenegado) {
        Alert.alert('Acceso no permitido', errorMessage);
      } else if (isOfflineRelated) {
        Alert.alert(
          'Error de conexión',
          'No se puede conectar al servidor.\n\nVerifica que:\n• La URL esté configurada en Configuración\n• El servidor esté activo y accesible\n• Tengas conexión a internet'
        );
      } else {
        Alert.alert('Error de autenticación', errorMessage);
      }
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
          <Text style={styles.subtitle}>Sistema Automatizado de Control de Inventarios</Text>
          
          {/* Indicador de conexión */}
          <View style={[styles.connectionIndicator, isConnected ? styles.connectionOnline : styles.connectionOffline]}>
            <View style={[styles.connectionDot, isConnected ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.connectionText}>
              {isConnected ? (isServerReachable ? 'En línea' : 'Sin servidor') : 'Sin conexión'}
            </Text>
          </View>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Iniciar Sesión</Text>

<View style={styles.inputContainer}>
            <View style={styles.inputLabelRow}>
              <MaterialCommunityIcons name="account" size={18} color={COLORS.lightGray} />
              <Text style={styles.label}>Usuario</Text>
            </View>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Ingrese su usuario"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputLabelRow}>
              <MaterialCommunityIcons name="lock" size={18} color={COLORS.lightGray} />
              <Text style={styles.label}>Contraseña</Text>
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Ingrese su contraseña"
              placeholderTextColor={COLORS.gray}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off' : 'eye'}
                size={22}
                color={COLORS.accent}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <View style={styles.loginButtonContent}>
                <MaterialCommunityIcons name="login" size={22} color={COLORS.white} />
                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
              </View>
            )}
          </TouchableOpacity>

          {isConnected && (
            <TouchableOpacity style={styles.forgotPasswordLink} onPress={() => router.push('/forgot-password')}>
              <Text style={styles.forgotPasswordText}>¿Olvidó su contraseña?</Text>
            </TouchableOpacity>
          )}
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
    marginBottom: 40,
  },
  logoContainer: {
    width: 160,
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.white,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 140,
    height: 110,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 4,
  },
subtitle: {
    fontSize: 14,
    color: COLORS.lightGray,
    marginTop: 5,
    letterSpacing: 1,
    textAlign: 'center',
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  connectionOnline: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  connectionOffline: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#4CAF50',
  },
  dotOffline: {
    backgroundColor: '#F44336',
  },
  connectionText: {
    fontSize: 12,
    color: COLORS.lightGray,
  },
  form: {
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    padding: 25,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 25,
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
  loginButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotPasswordLink: {
    marginTop: 15,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: COLORS.accent,
    fontSize: 14,
  },
});
