import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Animated, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

const introVideoSource = require('../../assets/entradaapp.mp4');

export default function AppIntroSplash({ isAppReady, onFinish }) {
  const [videoEnded, setVideoEnded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isDismissing = useRef(false);

  // Player de vídeo configurado especificamente para a introdução:
  // - Sem som (muted = true, volume = 0)
  // - Sem loop (loop = false)
  // - Reprodução automática ao abrir
  const player = useVideoPlayer(introVideoSource, (p) => {
    p.loop = false;
    p.muted = true;
    p.volume = 0;
    p.play();
  });

  useEffect(() => {
    if (!player) return;

    try {
      player.loop = false;
      player.muted = true;
      player.volume = 0;
      player.play();
    } catch (e) {
      console.warn('Aviso ao inicializar vídeo de abertura:', e);
    }

    // 1. Escuta o término do vídeo (chegou ao final)
    const playToEndSub = player.addListener('playToEnd', () => {
      setVideoEnded(true);
    });

    // 2. Escuta erro no player para não travar o app
    const statusSub = player.addListener('statusChange', (payload) => {
      if (payload?.status === 'error') {
        console.warn('Erro na reprodução do vídeo de entrada:', payload?.error);
        setVideoEnded(true);
      }
    });

    // 3. Fallback de segurança: vídeo tem ~6s; se passar de 7.5s, libera para não prender o usuário
    const safetyTimeout = setTimeout(() => {
      setVideoEnded(true);
    }, 7500);

    return () => {
      playToEndSub?.remove();
      statusSub?.remove();
      clearTimeout(safetyTimeout);
    };
  }, [player]);

  // Regra de transição:
  // O vídeo deve rodar até o final. Se o app já estiver carregado ao fim do vídeo, transiciona.
  // Se o vídeo terminar antes do app carregar, o player para no último frame (estático)
  // e assim que isAppReady for true, a transição suave para o app é executada.
  useEffect(() => {
    if (videoEnded && isAppReady && !isDismissing.current) {
      isDismissing.current = true;
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        try {
          player?.pause();
        } catch (e) {}
        if (onFinish) {
          onFinish();
        }
      });
    }
  }, [videoEnded, isAppReady, fadeAnim, onFinish, player]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents={videoEnded && isAppReady ? 'none' : 'auto'}
    >
      <VideoView
        style={styles.video}
        player={player}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        showsTimecodes={false}
        requiresLinearPlayback={true}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 999999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
