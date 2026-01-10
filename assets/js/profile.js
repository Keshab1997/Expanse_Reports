document.addEventListener('DOMContentLoaded', loadProfileData);

async function loadProfileData() {
    const emailInput = document.getElementById('email');
    const nameInput = document.getElementById('fullName');
    const avatarPreview = document.getElementById('avatarPreview');

    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return window.location.href = 'login.html';

        emailInput.value = user.email;

        // স্মার্ট ক্যাশিং: প্রথমে লোকাল ক্যাশ চেক করা
        const cachedUrl = localStorage.getItem(`avatar_${user.id}`);
        if (cachedUrl) {
            avatarPreview.src = cachedUrl;
        }

        // সার্ভার থেকে লেটেস্ট ডাটা আনা
        const { data, error } = await window.db
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            if (data.full_name) {
                nameInput.value = data.full_name;
            }

            if (data.avatar_url) {
                let finalUrl = data.avatar_url;
                if (!finalUrl.startsWith('http')) {
                    const { data: publicData } = window.db.storage.from('avatars').getPublicUrl(finalUrl);
                    finalUrl = publicData.publicUrl;
                }
                
                avatarPreview.src = finalUrl;
                localStorage.setItem(`avatar_${user.id}`, finalUrl);
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error.message);
    } finally {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    }
}

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

        alert('Profile updated successfully!');
        
    } catch (error) {
        alert(error.message);
    } finally {
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
        saveBtn.disabled = false;
    }
}

// ছবি আপলোড এবং কমপ্রেশন ফাংশন
async function uploadAvatar() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return;

    const avatarPreview = document.getElementById('avatarPreview');
    avatarPreview.style.opacity = '0.5'; // আপলোড হচ্ছে বোঝাতে

    try {
        // ইমেজ কমপ্রেশন (Canvas ব্যবহার করে)
        const compressedBlob = await compressImage(file, 300, 300); // ৩০০x৩০০ সাইজে ছোট করা হবে

        const { data: { user } } = await window.db.auth.getUser();
        const fileName = `${user.id}-${Date.now()}.jpg`; // ইউনিক নাম

        // সুপাবেসে আপলোড
        const { error: uploadError } = await window.db.storage
            .from('avatars')
            .upload(fileName, compressedBlob, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) throw uploadError;

        // ডাটাবেসে পাথ আপডেট
        const { data: publicData } = window.db.storage.from('avatars').getPublicUrl(fileName);
        const newUrl = publicData.publicUrl;

        await window.db.from('profiles').upsert({ id: user.id, avatar_url: newUrl });

        // লোকাল ক্যাশ আপডেট (যাতে বারবার লোড না হয়)
        localStorage.setItem(`avatar_${user.id}`, newUrl);
        
        avatarPreview.src = newUrl;
        const headerAvatar = document.getElementById('headerAvatar');
        if(headerAvatar) headerAvatar.src = newUrl;

        alert("Profile photo updated & optimized!");

    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        avatarPreview.style.opacity = '1';
    }
}

// ইমেজ কমপ্রেশন হেল্পার ফাংশন
function compressImage(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7); // ৭০% কোয়ালিটিতে সেভ হবে
            };
        };
    });
}