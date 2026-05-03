/**
 * Ephemeral 노드의 title 이 "비었음 또는 placeholder 그대로" 인지 판정.
 *
 * Why: addNode 가 새 ephemeral 노드를 만들 때 `defaultTitle:
 * t('untitledPlaceholder')` 로 채운다 ("(enter a name)" / "(이름 입력)").
 * 사용자가 입력하지 않고 넘어가면 이 placeholder 가 그대로 disk 에 저장될
 * 위험 — slugify 가 괄호만 제거해 "enter-a-name.md" / "이름-입력.md" 같은
 * placeholder-named 파일이 vault 에 silent pollution 으로 남는다.
 *
 * Inspector 의 save 버튼은 같은 룰로 disabled 되지만 (line ~248-251),
 * builder 의 ephemeral edge save chip 같은 다른 진입점은 별도 검증이
 * 필요해 단일 진실원으로 추출.
 *
 * locale 가 바뀌면 placeholder 문자열도 바뀐다 — 이 함수는 *현재* 호출
 * 시점의 placeholder 만 안다. 노드를 추가한 locale 과 다른 locale 로
 * 전환된 사용자가 옛 placeholder 그대로 저장하려는 edge case 는 허용
 * (slugify 가 빈 문자열 안 만들면 사용자 의도라 가정).
 */
export function isUntitledTitle(title: string, placeholder: string): boolean {
  const trimmedTitle = title.trim();
  if (trimmedTitle === "") return true;
  const trimmedPlaceholder = placeholder.trim();
  if (trimmedPlaceholder === "") return false; // placeholder 가 비면 모든 입력을 placeholder 로 오인 안 하게
  return trimmedTitle === trimmedPlaceholder;
}
