from flask import request

# Language translations
LANGUAGES = {
    'en': {
        'add_thought_placeholder': 'Share a thought...',
        'submit_button': 'Share',
        'submitting_button': 'Sharing...',
    },
    'sv': {
        'add_thought_placeholder': 'Dela en tanke...',
        'submit_button': 'Dela',
        'submitting_button': 'Delar...',
    }
}

def get_user_language():
    """Detect user language from Accept-Language header"""
    accept_language = request.headers.get('Accept-Language', '')
    
    # Check if Swedish is preferred
    if 'sv-SE' in accept_language or 'sv' in accept_language:
        return 'sv'
    
    # Default to English
    return 'en'

def get_text(key, lang=None):
    """Get translated text for a given key"""
    if lang is None:
        lang = get_user_language()
    
    return LANGUAGES.get(lang, LANGUAGES['en']).get(key, key)

def get_all_texts(lang=None):
    """Get all translations for a language"""
    if lang is None:
        lang = get_user_language()
    
    return LANGUAGES.get(lang, LANGUAGES['en'])
