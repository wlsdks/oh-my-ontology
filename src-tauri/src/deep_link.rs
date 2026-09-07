//! One inbound address, and nothing else: `ontology-atlas://mcp?install=<payload>`.
//!
//! ## What this is allowed to be
//!
//! A five-seat PO council rejected an OS URL scheme 0/24 on 2026-08-24, and its OUT list is
//! still the boundary here: **no uid addresses, no node addresses, no second address vocabulary
//! for vault meaning, no URL that writes or executes anything.** What the 2026-09-07 record
//! reopened is narrower than the thing that was refused — a vendor page's "Add to …" button,
//! the shape Cursor and VS Code already publish, whose whole effect is that a form opens with
//! its boxes filled in. `src/shared/lib/mcp-install-link.ts` is what reads the payload, and it
//! refuses an unknown field, drops every value, and leaves the connector switch off.
//!
//! ## So this module is a doorman, not a router
//!
//! It answers exactly one grammar and refuses everything else by **rejection, not repair** —
//! the same discipline as `is_safe_verify_base_url` in `lib.rs`:
//!
//! 1. The scheme is `ontology-atlas:` and the destination is `mcp`. No other host, no path.
//! 2. The query carries `install` and **nothing else**. A second key — `token`, `redirect`,
//!    anything — refuses the whole URL, so an address can never smuggle a credential or a
//!    destination past the one parameter this door exists for.
//! 3. The payload stays percent-encoded and must be made of URL-safe characters only, under a
//!    fixed byte cap. A quote, a backslash, an angle bracket or a space is a refusal, so nothing
//!    that reaches the script builder below can end a JavaScript literal.
//! 4. A refusal is logged and dropped. It never navigates anywhere — a URL that fails this
//!    parser must not be able to move the window at all, which is the difference between a
//!    doorman and an open redirect.
//!
//! The payload itself is still untrusted after all four. It is handed to the same parser the
//! web address bar already feeds, unchanged, and that parser's limits — one level of decoding,
//! `http(s)` only for a remote entry, names without values — are what protect the person.

/// The cap on the encoded payload. A base64 MCP server config is a few hundred bytes; four
/// kilobytes is generous for a real one and small enough that nothing interesting fits beside it.
pub(crate) const MAX_INSTALL_PAYLOAD_BYTES: usize = 4096;

/// Why a URL was refused. Every variant is logged verbatim, because "the link did nothing" with
/// no reason in the log is the report nobody can act on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum DeepLinkRefusal {
    /// Not `ontology-atlas:` at all.
    ForeignScheme,
    /// Ours, but pointed somewhere that is not the MCP install door.
    NotTheInstallDoor,
    /// No `install` parameter, or an empty one.
    NoPayload,
    /// A query key besides `install`. Named so the log says which one.
    ExtraQueryKey(String),
    /// A character outside the URL-safe set the payload is allowed to use.
    PayloadCharacter(char),
    /// Longer than [`MAX_INSTALL_PAYLOAD_BYTES`].
    PayloadTooLong(usize),
}

impl std::fmt::Display for DeepLinkRefusal {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ForeignScheme => write!(formatter, "not an ontology-atlas: URL"),
            Self::NotTheInstallDoor => {
                write!(formatter, "only ontology-atlas://mcp?install= is answered")
            }
            Self::NoPayload => write!(formatter, "no install payload"),
            Self::ExtraQueryKey(key) => write!(formatter, "unexpected query key {key:?}"),
            Self::PayloadCharacter(character) => {
                write!(formatter, "payload character {character:?} is not URL-safe")
            }
            Self::PayloadTooLong(length) => write!(
                formatter,
                "payload is {length} bytes, over the {MAX_INSTALL_PAYLOAD_BYTES} cap"
            ),
        }
    }
}

/// The characters an encoded payload may use: the base64 alphabet, its url-safe variant, padding,
/// and percent-encoding. Deliberately no quote, backslash, angle bracket, ampersand or space.
fn is_payload_character(character: char) -> bool {
    character.is_ascii_alphanumeric()
        || matches!(character, '+' | '/' | '=' | '-' | '_' | '.' | '~' | '%')
}

/// One arriving URL → the still-encoded `install` payload, or the reason it was refused.
///
/// The payload is returned exactly as it appeared in the address. It is not decoded here: the
/// value that goes back into `?install=` on the route has to be the value the web parser would
/// have received from an address bar, or the two callers of one parser would disagree.
pub(crate) fn parse_install_deep_link(raw: &str) -> Result<String, DeepLinkRefusal> {
    let trimmed = raw.trim();
    let rest = trimmed
        .strip_prefix("ontology-atlas://")
        .or_else(|| {
            // A few clients hand the scheme back capitalised. Only the scheme is case-folded;
            // the destination and the payload are compared as written.
            let (scheme, rest) = trimmed.split_once("://")?;
            scheme
                .eq_ignore_ascii_case("ontology-atlas")
                .then_some(rest)
        })
        .ok_or(DeepLinkRefusal::ForeignScheme)?;

    let (destination, query) = match rest.split_once('?') {
        Some((destination, query)) => (destination, query),
        None => (rest, ""),
    };
    // `mcp`, or `mcp/` from a client that normalises a bare host into a rooted path. Nothing else:
    // a fragment, a deeper path or a second segment is a different address, and this door answers
    // exactly one.
    if !matches!(destination, "mcp" | "mcp/") {
        return Err(DeepLinkRefusal::NotTheInstallDoor);
    }

    let mut payload: Option<&str> = None;
    for pair in query.split('&').filter(|pair| !pair.is_empty()) {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        if key != "install" {
            return Err(DeepLinkRefusal::ExtraQueryKey(key.to_string()));
        }
        // A repeated `install=` is a second payload, and picking one of two would be guessing.
        if payload.is_some() {
            return Err(DeepLinkRefusal::ExtraQueryKey("install".to_string()));
        }
        payload = Some(value);
    }

    let payload = payload
        .filter(|value| !value.is_empty())
        .ok_or(DeepLinkRefusal::NoPayload)?;
    if payload.len() > MAX_INSTALL_PAYLOAD_BYTES {
        return Err(DeepLinkRefusal::PayloadTooLong(payload.len()));
    }
    if let Some(character) = payload
        .chars()
        .find(|character| !is_payload_character(*character))
    {
        return Err(DeepLinkRefusal::PayloadCharacter(character));
    }
    Ok(payload.to_string())
}

/// The script that takes the window to the pre-filled form, and says whether it is already there.
///
/// The locale is read from the address the window is already on rather than guessed in Rust: the
/// app has one locale-prefixed route tree, and a person reading Korean must not be moved to the
/// English one by a link. `location.assign` rather than a history push, because the static export
/// serves `/<locale>/mcp/` as its own document and the App Router does not soft-navigate from a
/// raw history call; the vault handle survives, since it lives in IndexedDB and is restored on
/// boot exactly as it is after the updater's restart.
///
/// It returns `true` once there is nothing left to do, so the caller can stop. That answer is what
/// makes a **cold start** work: a link pressed while Atlas is closed arrives before the first
/// document exists, and one blind `eval` into a page that is not there yet is a link that silently
/// did nothing. So the caller repeats this until it answers.
///
/// ⚠️ **One assignment per link, remembered in `sessionStorage`.** Measured 2026-09-07 on the
/// installed app: re-evaluating every 250 ms restarted the navigation before it committed, twenty
/// times, and the window never arrived. And a vault-less app answers a workbench route by sending
/// the person back to first run (`VaultRouteIdentityBoundary`), so a script that only asked "am I
/// there yet" would bounce that screen for five seconds. The marker survives the navigation, which
/// a `window` property does not, so a link that was redirected away is a link that stops.
///
/// The payload is checked by [`parse_install_deep_link`] before it can reach this function, so it
/// carries no character that could end the literal. It is escaped anyway: a second line of defence
/// costs nothing, and the day somebody calls this from a new place is the day the first one moves.
pub(crate) fn build_install_route_script(payload: &str) -> String {
    let payload = crate::js_string_literal(payload);
    format!(
        r#"(() => {{
  const payload = {payload};
  const query = "?tab=connectors&install=" + payload;
  if (location.pathname.endsWith("/mcp/") && location.search === query) return true;
  let tried = null;
  try {{ tried = sessionStorage.getItem("atlas.deepLink"); }} catch (error) {{ tried = null; }}
  if (tried === payload) return true;
  try {{ sessionStorage.setItem("atlas.deepLink", payload); }} catch (error) {{ /* private mode */ }}
  const locale = location.pathname.startsWith("/ko/") ? "ko" : "en";
  location.assign("/" + locale + "/mcp/" + query);
  return false;
}})()"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The canonical link a vendor page would publish: base64 config, one parameter.
    #[test]
    fn the_mcp_install_door_hands_back_its_payload_untouched() {
        let payload = "eyJuYW1lIjoiTm90aW9uIiwidHlwZSI6Imh0dHAiLCJ1cmwiOiJodHRwczovL21jcC5ub3Rpb24uY29tL21jcCJ9";
        assert_eq!(
            parse_install_deep_link(&format!("ontology-atlas://mcp?install={payload}")),
            Ok(payload.to_string())
        );
    }

    /// A client that rooted the path, and one that shouted the scheme, are the same address.
    #[test]
    fn a_rooted_path_and_a_capitalised_scheme_are_the_same_door() {
        assert_eq!(
            parse_install_deep_link("ontology-atlas://mcp/?install=e30"),
            Ok("e30".to_string())
        );
        assert_eq!(
            parse_install_deep_link("Ontology-Atlas://mcp?install=e30"),
            Ok("e30".to_string())
        );
    }

    /// **The security case this door exists to fail.** A token riding beside the payload is not
    /// stripped and it is not ignored: it refuses the whole URL, because a link that could carry a
    /// credential into the app is a link somebody will eventually be tricked into pressing. The
    /// payload's own limits — one level of decoding, values dropped, `http(s)` only — live in
    /// `src/shared/lib/mcp-install-link.ts`; this is the layer before them.
    #[test]
    fn a_url_carrying_a_token_is_refused_whole() {
        for url in [
            "ontology-atlas://mcp?install=e30&token=sk-live-0123456789",
            "ontology-atlas://mcp?token=sk-live-0123456789&install=e30",
            "ontology-atlas://mcp?install=e30&access_token=abc",
        ] {
            assert!(
                matches!(
                    parse_install_deep_link(url),
                    Err(DeepLinkRefusal::ExtraQueryKey(_))
                ),
                "{url} must be refused whole, not trimmed down to its payload"
            );
        }
    }

    /// Two payloads is a question this parser refuses to answer by guessing.
    #[test]
    fn a_second_install_parameter_refuses_rather_than_picks() {
        assert!(parse_install_deep_link("ontology-atlas://mcp?install=e30&install=e31").is_err());
    }

    /// Nothing but the MCP door answers. In particular no address that could name a vault node,
    /// which is the part of the 2026-08-24 rejection that still stands.
    #[test]
    fn no_other_destination_is_answered() {
        for url in [
            "ontology-atlas://concept/9d1f?install=e30",
            "ontology-atlas://topology?install=e30",
            "ontology-atlas://mcp/install?config=e30",
            "ontology-atlas://mcp/connectors?install=e30",
            "ontology-atlas://",
        ] {
            assert!(
                parse_install_deep_link(url).is_err(),
                "{url} must not open anything"
            );
        }
    }

    /// A foreign scheme is not this app's business even when the rest of it looks familiar.
    #[test]
    fn a_foreign_scheme_is_refused_before_anything_else() {
        assert_eq!(
            parse_install_deep_link("https://ontologyatlas.com/mcp?install=e30"),
            Err(DeepLinkRefusal::ForeignScheme)
        );
        assert_eq!(
            parse_install_deep_link("file:///etc/passwd"),
            Err(DeepLinkRefusal::ForeignScheme)
        );
    }

    /// Characters that could end a JavaScript literal never reach the script builder.
    #[test]
    fn a_payload_with_an_unsafe_character_is_refused() {
        for url in [
            "ontology-atlas://mcp?install=e30\"+alert(1)",
            "ontology-atlas://mcp?install=e30'",
            "ontology-atlas://mcp?install=e30\\",
            "ontology-atlas://mcp?install=e 30",
            "ontology-atlas://mcp?install=<script>",
        ] {
            assert!(
                matches!(
                    parse_install_deep_link(url),
                    Err(DeepLinkRefusal::PayloadCharacter(_))
                ),
                "{url} must be refused for its characters"
            );
        }
    }

    #[test]
    fn an_oversized_payload_is_refused_rather_than_truncated() {
        let payload = "a".repeat(MAX_INSTALL_PAYLOAD_BYTES + 1);
        assert_eq!(
            parse_install_deep_link(&format!("ontology-atlas://mcp?install={payload}")),
            Err(DeepLinkRefusal::PayloadTooLong(
                MAX_INSTALL_PAYLOAD_BYTES + 1
            ))
        );
    }

    /// The route the window is sent to is the address the web side already reads, it keeps the
    /// locale the person is on, and it reports arrival instead of assigning a second time.
    #[test]
    fn the_script_builds_the_locale_relative_connectors_route() {
        let script = build_install_route_script("e30");
        assert!(script.contains(r#"const payload = "e30";"#), "{script}");
        assert!(
            script.contains(r#""?tab=connectors&install=" + payload"#),
            "{script}"
        );
        assert!(
            script.contains(r#"location.pathname.startsWith("/ko/")"#),
            "{script}"
        );
        assert!(script.contains("return true;"), "{script}");
        // One assignment per link: the marker outlives the navigation, so a redirect stops it.
        assert!(
            script.contains(r#"sessionStorage.setItem("atlas.deepLink", payload)"#),
            "{script}"
        );
        assert!(
            script.contains("if (tried === payload) return true;"),
            "{script}"
        );
    }
}
