# Data Governance

O tratamento lícito dos dados pessoais do cliente sob a LGPD: consentimento, auditoria de mudanças, exportação e anonimização. Escrito por ambos os apps, com papéis distintos: o **storefront** grava **Consent** (no checkout/banner) e dispara a **Anonymization** (via CLI `db:anonymize-client`); **Audit Trail** e **Data Export** são operados pelo **dashboard** (staff).

## Language

**Data Subject**:
O **Client** cujos dados pessoais este contexto governa. É o **Client** visto pela ótica da LGPD.

**Consent**:
O registro de que um **Client** concedeu ou revogou consentimento para uma finalidade específica, com a versão da política vigente e os metadados de captura (IP, user-agent, instantes de concessão e revogação).
_Avoid_: Permission, Opt-in

**Consent Kind**:
A finalidade de um **Consent**: `tos` (termos de uso), `privacy` (política de privacidade), `marketing_email` ou `cookies`. No **checkout** são gravados `tos`, `privacy` e `marketing_email`; `cookies` é capturado no banner de consentimento, não no checkout.

**Audit Trail**:
O registro imutável de cada mudança nos dados de um **Client** — o estado antes e depois, o ator, a **Audit Action** e o motivo.
_Avoid_: Log, History

**Audit Action**:
O tipo de mudança capturada numa entrada do **Audit Trail**: `profile_updated`, `status_changed`, `type_changed`, `notes_updated`, `session_revoked`, `sessions_revoked_all`, `password_reset_link_generated`, `exported`.

**Data Export**:
O registro de uma exportação em massa de dados de **Clients** feita por um **User** do staff — os filtros aplicados, a contagem de linhas, os bytes escritos e se o resultado foi truncado.

**Anonymization**:
A operação de direito ao esquecimento da LGPD que remove os dados pessoais de um **Client** (`db:anonymize-client`).
_Avoid_: Deletion, Removal — o registro do **Client** permanece; os dados pessoais é que são apagados

## Relationships

- Um **Client** acumula zero ou mais entradas de **Consent**, uma por (finalidade, momento)
- Cada mudança nos dados de um **Client** gera uma entrada de **Audit Trail**
- Uma **Data Export** é executada por um **User** do staff sobre um conjunto de **Clients**
- Uma **Anonymization** encerra o tratamento dos dados pessoais de um **Client**

## Example dialogue

> **Dev:** "Quando o cliente fecha um pedido, registramos o **Consent**?"
> **Domain expert:** "Sim — o checkout grava um **Consent** de `tos`, um de `privacy` e um de `marketing_email`, cada um com a versão da política."
> **Dev:** "Anonimizar um **Client** apaga a linha dele?"
> **Domain expert:** "Não — a linha do **Client** fica. A **Anonymization** remove os dados pessoais; o histórico de **Orders** continua íntegro."

## Flagged ambiguities

- "Lead" (consentimento de um prospecto sem conta) foi um conceito previsto mas não existe na DB real — `consent_log` só registra **Consent** de **Client**. Termo morto.
