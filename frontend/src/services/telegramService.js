export function getTelegramData() {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    return {
      isTelegram: false,
      user: null
    };
  }

  try {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#020617');

    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
      return {
        isTelegram: true,
        user: {
          id: `tg_${tgUser.id}`,
          username: tgUser.username || `tg_${tgUser.id}`,
          displayName: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || tgUser.username || 'Telegram Player'
        }
      };
    }
  } catch (e) {
    console.warn('Error reading Telegram WebApp:', e);
  }

  return {
    isTelegram: true,
    user: null
  };
}
