'use client';

import { useMemo } from 'react';
import { useLocalVault } from '@/features/docs-vault-local';
import {
  deriveOntologyFromVault,
  type VaultOntologyDerivation,
} from '@/entities/docs-vault';

/**
 * 활성 로컬 vault 의 frontmatter 에서 추출한 ontology stub 을 라이브로 노출.
 *
 * vault 가 활성화 ('loaded') 되어 있어야 실제 derivation 을 반환. 그 외에는
 * 빈 결과 + warning 한 줄. UI 는 이 결과를 *AI 추출 거치지 않은 fast path*
 * stub 으로 인지하고, 검수 큐로 promote 가능한 후보로 표시.
 */
export function useVaultOntology(): VaultOntologyDerivation {
  const vault = useLocalVault();
  return useMemo<VaultOntologyDerivation>(() => {
    if (vault.status !== 'loaded' || !vault.manifest) {
      return {
        nodes: [],
        edges: [],
        warnings: ['로컬 vault 가 열려있지 않아 ontology stub 추출 대상이 없습니다.'],
      };
    }
    return deriveOntologyFromVault(vault.manifest);
  }, [vault.status, vault.manifest]);
}
