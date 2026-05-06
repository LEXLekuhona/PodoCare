import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import {
  completeQuizSession,
  createQuizSession,
  fetchActiveQuiz,
  submitQuizAnswer,
  type QuizDto,
  type QuizResultDto,
} from '@/features/quiz/quiz-api';
import {
  getQuizAnonToken,
  setLastQuizSessionId,
} from '@/features/quiz/quiz-session-store';
import { ApiError } from '@/shared/api/api-error';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

export function QuizPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const activeQuiz = await fetchActiveQuiz();
        const anonToken = await getQuizAnonToken();
        const session = await createQuizSession({ quizId: activeQuiz.id, anonToken });
        if (cancelled) return;
        await setLastQuizSessionId(session.sessionId);
        setQuiz(activeQuiz);
        setSessionId(session.sessionId);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'Не удалось запустить квиз');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const questions = quiz?.questions ?? [];
  const currentQuestion = questions[stepIndex] ?? null;
  const selectedOptionId = currentQuestion ? selectedByQuestion[currentQuestion.id] : undefined;
  const progressLabel = useMemo(
    () => (questions.length > 0 ? `${Math.min(stepIndex + 1, questions.length)} / ${questions.length}` : ''),
    [stepIndex, questions.length],
  );

  async function onContinue() {
    if (!currentQuestion || !selectedOptionId || !sessionId || submitting) return;
    setSubmitting(true);
    try {
      await submitQuizAnswer(sessionId, {
        questionId: currentQuestion.id,
        optionIds: [selectedOptionId],
      });
      if (stepIndex < questions.length - 1) {
        setStepIndex((prev) => prev + 1);
      } else {
        const completed = await completeQuizSession(sessionId);
        setResult(completed.result);
      }
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить ответ');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (result) {
    return (
      <View style={styles.root}>
        <SafeAreaPadding minTop={16} minBottom={16} style={styles.content}>
          <Text style={styles.title}>Ваш результат</Text>
          <Text style={styles.segment}>{result.segment}</Text>
          <Text style={styles.score}>Скоринг: {result.score}</Text>
          {result.title ? <Text style={styles.resultTitle}>{result.title}</Text> : null}
          {result.description ? <Text style={styles.resultDescription}>{result.description}</Text> : null}
          <Pressable
            onPress={() => router.replace('/(auth)/phone')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>
              {result.recommendedCta?.label?.trim() || 'Продолжить и сохранить результат'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(auth)/phone')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Позже</Text>
          </Pressable>
        </SafeAreaPadding>
      </View>
    );
  }

  if (!quiz || !currentQuestion) {
    return (
      <View style={styles.centered}>
        <Text>{error ?? 'Квиз недоступен'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaPadding minTop={10} minBottom={0} style={styles.topNav} lightColor="transparent" darkColor="transparent">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backButtonText}>Назад</Text>
        </Pressable>
      </SafeAreaPadding>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{quiz.title}</Text>
        {quiz.description ? <Text style={styles.description}>{quiz.description}</Text> : null}
        <Text style={styles.progress}>{progressLabel}</Text>
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.text}</Text>
          <View style={styles.options}>
            {currentQuestion.options.map((option) => {
              const active = option.id === selectedOptionId;
              return (
                <Pressable
                  key={option.id}
                  onPress={() =>
                    setSelectedByQuestion((prev) => ({ ...prev, [currentQuestion.id]: option.id }))
                  }
                  style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <SafeAreaPadding minTop={0} minBottom={16} style={styles.footer} lightColor="transparent" darkColor="transparent">
        <Pressable
          onPress={() => void onContinue()}
          disabled={!selectedOptionId || submitting}
          style={({ pressed }) => [
            styles.primaryButton,
            (!selectedOptionId || submitting) && styles.disabledButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {stepIndex < questions.length - 1 ? 'Далее' : 'Показать результат'}
          </Text>
        </Pressable>
      </SafeAreaPadding>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topNav: { paddingHorizontal: 16, paddingBottom: 8 },
  backButton: { paddingVertical: 8, alignSelf: 'flex-start' },
  backButtonText: { fontSize: 15, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '800', lineHeight: 36 },
  description: { fontSize: 15, lineHeight: 22, opacity: 0.7 },
  progress: { fontSize: 13, fontWeight: '700', opacity: 0.65 },
  questionCard: {
    borderWidth: 1,
    borderColor: 'rgba(149,163,160,0.35)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  questionText: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  options: { gap: 10 },
  option: {
    borderWidth: 1,
    borderColor: 'rgba(149,163,160,0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionActive: {
    borderColor: '#2D6A4F',
    backgroundColor: 'rgba(45,106,79,0.10)',
  },
  optionText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  optionTextActive: { color: '#2D6A4F' },
  errorText: { color: '#BA1A1A', fontSize: 13, fontWeight: '600' },
  footer: { paddingHorizontal: 20 },
  primaryButton: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
  secondaryButton: {
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(149,163,160,0.45)',
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '700' },
  segment: { fontSize: 26, fontWeight: '800', color: '#2D6A4F' },
  score: { fontSize: 14, opacity: 0.7 },
  resultTitle: { fontSize: 20, fontWeight: '700' },
  resultDescription: { fontSize: 15, lineHeight: 22 },
  pressed: { opacity: 0.85 },
});
