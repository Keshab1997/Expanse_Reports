document.addEventListener('DOMContentLoaded', loadProfileData);

async function loadProfileData() {
    const emailInput = document.getElementById('email');
    const nameInput = document.getElementById('fullName');
    const avatarPreview = document.getElementById('avatarPreview');

    // ১. স্মার্ট ক্যাশিং: যদি লোকাল স্টোরেজে ছবি থাকে, সার্ভারের অপেক্ষা না করে আগে সেটা দেখাও
    const cachedAvatar = localStorage.getItem('cached_avatar_url');
    const cachedName = localStorage.getItem('cached_user_name');
    
    if (cachedAvatar) avatarPreview.src = cachedAvatar;
    if (cachedName) nameInput.value = cachedName;

    // ২. সার্ভার থেকে লেটেস্ট ডাটা আনা
    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return window.location.href = 'login.html';

        emailInput.value = user.email;

        // প্রোফাইল টেবিল থেকে ডাটা আনা
        const { data, error } = await window.db
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            // নাম আপডেট এবং ক্যাশ করা
            if (data.full_name) {
                nameInput.value = data.full_name;
                localStorage.setItem('cached_user_name', data.full_name);
            }

            // ছবি হ্যান্ডলিং
            if (data.avatar_url) {
                let finalUrl = data.avatar_url;

                // যদি ফুল লিংক না হয়, তাহলে স্টোরেজ থেকে লিংক জেনারেট করো
                if (!finalUrl.startsWith('http')) {
                    const { data: publicData } = window.db.storage.from('avatars').getPublicUrl(finalUrl);
                    finalUrl = publicData.publicUrl;
                }

                // ৩. যদি সার্ভারের ছবি আর ক্যাশ করা ছবি আলাদা হয়, বা ক্যাশ না থাকে -> আপডেট করো
                // আমরা এখানে '?t=' ব্যবহার করছি না রিড করার সময়, যাতে ব্রাউজার ক্যাশ কাজ করে
                if (finalUrl !== cachedAvatar) {
                    avatarPreview.src = finalUrl;
                    localStorage.setItem('cached_avatar_url', finalUrl); // নতুন লিংক সেভ
                }
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error.message);
    } finally {
        // লোডার বন্ধ (globalLoader যদি HTML এ থাকে)
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    }
}

// ৪. প্রোফাইল আপডেট ফাংশন
async function updateProfile() {
    const fullName = document.getElementById('fullName').value;
    const saveBtn = document.getElementById('saveBtn');
    
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    try {
        const { data: { user } } = await window.db.auth.getUser();

        const updates = {
            id: user.id,
            full_name: fullName,
            updated_at: new Date()
        };

        const { error } = await window.db.from('profiles').upsert(updates);
        if (error) throw error;

        // আপডেট সফল হলে ক্যাশ আপডেট করো
        localStorage.setItem('cached_user_name', fullName);
        alert('Profile updated successfully!');
        
    } catch (error) {
        alert(error.message);
    } finally {
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
        saveBtn.disabled = false;
    }
}

// ৫. ছবি আপলোড ফাংশন
async function uploadAvatar() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return;

    // লোডার বা ইন্ডিকেটর
    const avatarPreview = document.getElementById('avatarPreview');
    const originalSrc = avatarPreview.src;
    avatarPreview.style.opacity = '0.5'; // আপলোড হচ্ছে বোঝাতে

    try {
        const { data: { user } } = await window.db.auth.getUser();
        
        // ফাইলের নাম ইউনিক করা (যাতে ক্যাশ সমস্যা না করে)
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        // ১. ছবি আপলোড
        const { error: uploadError } = await window.db.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // ২. ডাটাবেসে লিংক আপডেট
        const { error: updateError } = await window.db
            .from('profiles')
            .upsert({ 
                id: user.id, 
                avatar_url: filePath,
                updated_at: new Date() 
            });

        if (updateError) throw updateError;

        // ৩. নতুন পাবলিক লিংক তৈরি
        const { data: publicData } = window.db.storage.from('avatars').getPublicUrl(filePath);
        const newUrl = publicData.publicUrl;

        // ৪. UI এবং ক্যাশ আপডেট (তাৎক্ষণিক পরিবর্তনের জন্য)
        avatarPreview.src = newUrl;
        localStorage.setItem('cached_avatar_url', newUrl); // নতুন ছবি ক্যাশে সেট
        
        // হেডারের ছবিও পাল্টে দেওয়া
        const headerAvatar = document.getElementById('headerAvatar');
        if(headerAvatar) headerAvatar.src = newUrl;

        alert("Profile photo updated!");

    } catch (error) {
        alert('Error uploading avatar: ' + error.message);
        avatarPreview.src = originalSrc; // ফেইল হলে আগের ছবি ফেরত
    } finally {
        avatarPreview.style.opacity = '1';
        fileInput.value = ''; // ইনপুট রিসেট
    }
}