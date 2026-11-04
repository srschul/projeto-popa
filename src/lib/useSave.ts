import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast';
import { keys } from './data';
import { errorMessage } from './format';
import type { AchievementDefinition, UserAchievement, XpSummary } from './types';

/**
 * Depois de gravar algo: recarrega os dados do banco e compara XP, nível e conquistas
 * com o que havia antes, avisando só o que de fato mudou (o cálculo é feito pelo banco).
 */
export function useAfterSave() {
  const qc = useQueryClient();
  const toast = useToast();

  return useCallback(
    async (okMessage: string) => {
      const beforeXp = qc.getQueryData<XpSummary | null>(keys.xp);
      const beforeAch = qc.getQueryData<UserAchievement[]>(keys.achievements);

      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.workouts }),
        qc.invalidateQueries({ queryKey: keys.body }),
        qc.invalidateQueries({ queryKey: keys.sleep }),
        qc.invalidateQueries({ queryKey: keys.photos }),
        qc.invalidateQueries({ queryKey: keys.settings }),
        qc.invalidateQueries({ queryKey: keys.xp }),
        qc.invalidateQueries({ queryKey: keys.achievements }),
        qc.invalidateQueries({ queryKey: keys.missions }),
      ]);

      const afterXp = qc.getQueryData<XpSummary | null>(keys.xp);
      const afterAch = qc.getQueryData<UserAchievement[]>(keys.achievements);
      const defs = qc.getQueryData<AchievementDefinition[]>(keys.achievementDefs) ?? [];

      toast.show(okMessage);

      if (beforeXp && afterXp && afterXp.total_xp > beforeXp.total_xp) {
        toast.show(`+${afterXp.total_xp - beforeXp.total_xp} XP`, 'xp');
      }
      if (beforeXp && afterXp && afterXp.level && beforeXp.level && afterXp.level > beforeXp.level) {
        toast.show(`Novo nível: ${afterXp.level_name}!`, 'xp');
      }
      if (beforeAch && afterAch) {
        const had = new Set(beforeAch.map((a) => a.code));
        for (const a of afterAch.filter((x) => !had.has(x.code))) {
          toast.show(`Conquista: ${defs.find((d) => d.code === a.code)?.title ?? a.code}`, 'xp');
        }
      }
    },
    [qc, toast],
  );
}

export function useErrorToast() {
  const toast = useToast();
  return useCallback((e: unknown) => toast.show(errorMessage(e), 'error'), [toast]);
}
