// Push notification wording in the person's own language.

type Kind = 'message' | 'checkin' | 'checkin_reviewed' | 'new_athlete' | 'targets_changed' | 'routine_given';
type Lang = 'en' | 'ar' | 'es' | 'fr' | 'de' | 'pt' | 'tr' | 'it';

const T: Record<Lang, Record<Kind, { title: string; body: string }>> = {
  en: {
    message: { title: '{name}', body: '{preview}' },
    checkin: { title: 'New weekly check-in', body: '{name} sent their check-in. Review it in the coach portal.' },
    checkin_reviewed: { title: 'Your coach replied', body: '{name} reviewed your weekly check-in.' },
    new_athlete: { title: 'New athlete', body: '{name} joined your team.' },
    targets_changed: { title: 'New nutrition targets', body: '{name} updated your calories and macros.' },
    routine_given: { title: 'New routine', body: '{name} gave you a new training routine.' },
  },
  ar: {
    message: { title: '{name}', body: '{preview}' },
    checkin: { title: 'متابعة أسبوعية جديدة', body: 'أرسل {name} متابعته. راجعها في بوابة المدرب.' },
    checkin_reviewed: { title: 'ردّ مدربك', body: 'راجع {name} متابعتك الأسبوعية.' },
    new_athlete: { title: 'لاعب جديد', body: 'انضم {name} إلى فريقك.' },
    targets_changed: { title: 'أهداف غذائية جديدة', body: 'حدّث {name} سعراتك ومغذياتك.' },
    routine_given: { title: 'برنامج جديد', body: 'أعطاك {name} برنامج تمرين جديدًا.' },
  },
  es: {
    message: { title: '{name}', body: '{preview}' },
    checkin: { title: 'Nueva revisión semanal', body: '{name} envió su revisión. Revísala en el portal del coach.' },
    checkin_reviewed: { title: 'Tu coach respondió', body: '{name} revisó tu revisión semanal.' },
    new_athlete: { title: 'Nuevo atleta', body: '{name} se unió a tu equipo.' },
    targets_changed: { title: 'Nuevos objetivos de nutrición', body: '{name} actualizó tus calorías y macros.' },
    routine_given: { title: 'Nueva rutina', body: '{name} te asignó una nueva rutina.' },
  },
  fr: {
    message: { title: '{name}', body: '{preview}' },
    checkin: { title: 'Nouveau bilan hebdo', body: '{name} a envoyé son bilan. Relisez-le dans l’espace coach.' },
    checkin_reviewed: { title: 'Votre coach a répondu', body: '{name} a relu votre bilan hebdo.' },
    new_athlete: { title: 'Nouvel athlète', body: '{name} a rejoint votre équipe.' },
    targets_changed: { title: 'Nouveaux objectifs nutritionnels', body: '{name} a mis à jour vos calories et macros.' },
    routine_given: { title: 'Nouveau programme', body: '{name} vous a attribué un nouveau programme.' },
  },
  de: {
    message: { title: '{name}', body: '{preview}' },
    checkin: { title: 'Neuer wöchentlicher Check-in', body: '{name} hat den Check-in geschickt. Sieh ihn im Coach-Bereich an.' },
    checkin_reviewed: { title: 'Dein Coach hat geantwortet', body: '{name} hat deinen Check-in angesehen.' },
    new_athlete: { title: 'Neuer Athlet', body: '{name} ist deinem Team beigetreten.' },
    targets_changed: { title: 'Neue Ernährungsziele', body: '{name} hat deine Kalorien und Makros angepasst.' },
    routine_given: { title: 'Neuer Plan', body: '{name} hat dir einen neuen Trainingsplan gegeben.' },
  },
  pt: {
    message: { title: '{name}', body: '{preview}' },
    checkin: { title: 'Novo check-in semanal', body: '{name} enviou o check-in. Revise na área do coach.' },
    checkin_reviewed: { title: 'Seu coach respondeu', body: '{name} revisou seu check-in semanal.' },
    new_athlete: { title: 'Novo atleta', body: '{name} entrou no seu time.' },
    targets_changed: { title: 'Novas metas de nutrição', body: '{name} atualizou suas calorias e macros.' },
    routine_given: { title: 'Nova rotina', body: '{name} enviou uma nova rotina de treino.' },
  },
  tr: {
    message: { title: '{name}', body: '{preview}' },
    checkin: { title: 'Yeni haftalık check-in', body: '{name} check-in’ini gönderdi. Koç panelinde incele.' },
    checkin_reviewed: { title: 'Koçun yanıtladı', body: '{name} haftalık check-in’ini inceledi.' },
    new_athlete: { title: 'Yeni sporcu', body: '{name} takımına katıldı.' },
    targets_changed: { title: 'Yeni beslenme hedefleri', body: '{name} kalori ve makrolarını güncelledi.' },
    routine_given: { title: 'Yeni program', body: '{name} sana yeni bir antrenman programı verdi.' },
  },
  it: {
    message: { title: '{name}', body: '{preview}' },
    checkin: { title: 'Nuovo check-in settimanale', body: '{name} ha inviato il check-in. Rivedilo nell’area coach.' },
    checkin_reviewed: { title: 'Il tuo coach ha risposto', body: '{name} ha rivisto il tuo check-in settimanale.' },
    new_athlete: { title: 'Nuovo atleta', body: '{name} si è unito al tuo team.' },
    targets_changed: { title: 'Nuovi obiettivi alimentari', body: '{name} ha aggiornato calorie e macro.' },
    routine_given: { title: 'Nuova scheda', body: '{name} ti ha assegnato una nuova scheda.' },
  },
};

export function pushText(lang: string | null | undefined, kind: Kind, name: string, preview: string | null): { title: string; body: string } {
  const l = (lang && lang in T ? lang : 'en') as Lang;
  const t = T[l][kind] ?? T.en[kind];
  const fill = (s: string) => s.replace('{name}', name || 'StartFit').replace('{preview}', (preview ?? '').slice(0, 140) || '…');
  return { title: fill(t.title), body: fill(t.body) };
}
