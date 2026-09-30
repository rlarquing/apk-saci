// Punto de entrada: redirige siempre al login cuando no hay sesión.
// El layout (_layout.tsx) decide el Stack según el estado de autenticación.
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/login" />;
}