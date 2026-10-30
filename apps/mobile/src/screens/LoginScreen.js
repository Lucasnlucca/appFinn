import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { loginWithEmail } from '../services/appwriteService';
import { useFinance } from '../context/FinanceContext';

export default function LoginScreen({ onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const { setLoggedInUser } = useFinance();

  const [selectedProfile, setSelectedProfile] = useState('Henrique');
  const [email, setEmail] = useState('henrique@finn.local');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleProfileSelect = (name) => {
    setSelectedProfile(name);
    if (name === 'Henrique') {
      setEmail('henrique@finn.local');
    } else {
      setEmail('esposa@finn.local');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Campos obrigatórios', 'Por favor informe o e-mail e a senha do casal.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithEmail(email, password, selectedProfile);
      if (res.success) {
        setLoggedInUser(res.user);
        if (onLoginSuccess) onLoginSuccess(res.user);
      } else {
        Alert.alert('Erro ao entrar', res.error || 'Credenciais inválidas.');
      }
    } catch (err) {
      Alert.alert('Falha na autenticação', err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* LOGO & BOAS-VINDAS */}
        <View style={styles.brandSection}>
          <View style={styles.logoBadge}>
            <Ionicons name="sparkles" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.appTitle}>FINN AI</Text>
          <Text style={styles.appSubtitle}>Finanças Inteligentes para o Casal</Text>
          <View style={styles.vpsBadge}>
            <View style={styles.vpsDot} />
            <Text style={styles.vpsBadgeText}>Appwrite VPS • Nuvem Privada</Text>
          </View>
        </View>

        {/* SELEÇÃO DO CÔNJUGE */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>QUEM ESTÁ ACESSANDO?</Text>
          <View style={styles.profileRow}>
            <TouchableOpacity
              style={[
                styles.profileBtn,
                selectedProfile === 'Henrique' && styles.profileBtnActive,
              ]}
              onPress={() => handleProfileSelect('Henrique')}
            >
              <Ionicons
                name="person"
                size={18}
                color={selectedProfile === 'Henrique' ? COLORS.primary : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.profileBtnText,
                  selectedProfile === 'Henrique' && styles.profileBtnTextActive,
                ]}
              >
                Henrique
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.profileBtn,
                selectedProfile === 'Esposa' && styles.profileBtnActive,
              ]}
              onPress={() => handleProfileSelect('Esposa')}
            >
              <Ionicons
                name="heart"
                size={18}
                color={selectedProfile === 'Esposa' ? COLORS.primary : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.profileBtnText,
                  selectedProfile === 'Esposa' && styles.profileBtnTextActive,
                ]}
              >
                Esposa
              </Text>
            </TouchableOpacity>
          </View>

          {/* E-MAIL */}
          <Text style={styles.fieldLabel}>E-MAIL DE ACESSO</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.textInput}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="seu-email@dominio.com"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* SENHA */}
          <Text style={styles.fieldLabel}>SENHA</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.textInput}
              secureTextEntry={!showPassword}
              placeholder="Digite sua senha"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* BOTÃO DE LOGIN */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Entrar no FINN AI</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.exclusiveNotice}>
            🔒 Acesso restrito e criptografado para uso conjunto do casal.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginBottom: 16,
  },
  appTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  appSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  vpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  vpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  vpsBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 10,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  profileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  profileBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  profileBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  profileBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  textInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 16,
    marginTop: 24,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  exclusiveNotice: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 16,
  },
});
