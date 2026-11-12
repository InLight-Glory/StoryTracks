#[cfg(windows)]
pub fn installed() -> Result<Vec<String>, String> {
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, EnumFontFamiliesExW, DEFAULT_CHARSET, LOGFONTW, TEXTMETRICW,
    };
    unsafe extern "system" fn collect(
        font: *const LOGFONTW,
        _: *const TEXTMETRICW,
        _: u32,
        data: isize,
    ) -> i32 {
        // GDI calls this synchronously with a valid LOGFONTW and our Vec pointer.
        let name = unsafe { &(*font).lfFaceName };
        let end = name.iter().position(|&c| c == 0).unwrap_or(name.len());
        let name = String::from_utf16_lossy(&name[..end]);
        if !name.is_empty() && !name.starts_with('@') {
            unsafe { &mut *(data as *mut Vec<String>) }.push(name);
        }
        1
    }
    let mut names = Vec::<String>::new();
    let filter = LOGFONTW {
        lfCharSet: DEFAULT_CHARSET,
        ..Default::default()
    };
    unsafe {
        let dc = CreateCompatibleDC(std::ptr::null_mut());
        if dc.is_null() {
            return Err("Unable to read installed fonts.".into());
        }
        EnumFontFamiliesExW(dc, &filter, Some(collect), &mut names as *mut _ as isize, 0);
        DeleteDC(dc);
    }
    names.sort_by_key(|name| name.to_lowercase());
    names.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
    Ok(names)
}

#[cfg(not(windows))]
pub fn installed() -> Result<Vec<String>, String> {
    Err("Enter an installed font name on this platform.".into())
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn enumerates_installed_font_families() {
        let fonts = super::installed().unwrap();
        assert!(!fonts.is_empty());
        assert!(fonts.iter().any(|font| font == "Verdana"));
        assert!(fonts
            .windows(2)
            .all(|pair| pair[0].to_lowercase() < pair[1].to_lowercase()));
    }
}
