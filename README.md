# CRM Multi-Tenant con Integración SuperAPI

Sistema CRM multi-tenant con soporte para múltiples instancias de WhatsApp, Instagram y Facebook a través de SuperAPI.

## 🔗 Configuración de Webhook SuperAPI

### URL del Webhook

**IMPORTANTE**: La URL del webhook DEBE incluir el parámetro `secret` para identificar la empresa.

**Formato correcto:**
```
https://[TU-PROYECTO].supabase.co/functions/v1/webhook-chat?secret=[WEBHOOK_SECRET]
```

**Ejemplo:**
```
https://bjdqjxrwvktfqienbzop.supabase.co/functions/v1/webhook-chat?secret=perdomo_secret_crm
```

### Configuración en SuperAPI

1. **Callback URL**: `https://[TU-PROYECTO].supabase.co/functions/v1/webhook-chat?secret=[WEBHOOK_SECRET]&x=1`
2. **Identificador de verificación**: `[WEBHOOK_SECRET]` (el mismo valor)

**Ejemplo real:**
```
Callback URL: https://bjdqjxrwvktfqienbzop.supabase.co/functions/v1/webhook-chat?secret=perdomo_secret_crm&x=1
Identificador: perdomo_secret_crm
```

> **Nota**: El parámetro `&x=1` es un parámetro dummy necesario para que SuperAPI pueda agregar sus parámetros de verificación (`hub.verify_token`, `hub.challenge`, `hub.mode`) correctamente usando `&` en lugar de `?`. SuperAPI NO agrega el `secret` en las peticiones POST de mensajes, por eso debe estar en la URL base.

### Eventos a Configurar

Asegúrate de activar estos eventos en SuperAPI:
- ✅ `message` o `messages.received`
- ✅ `message_create`
- ✅ Todos los eventos relacionados con mensajes entrantes

---

## 📚 Documentación Completa

Para instrucciones detalladas de configuración y pruebas, consulta:
- **Walkthrough**: `.gemini/antigravity/brain/[conversation-id]/walkthrough.md`
- **Plan de Implementación**: `.gemini/antigravity/brain/[conversation-id]/implementation_plan.md`

---

📄 **License**: MIT



.
..
....
.....
......