document.addEventListener('DOMContentLoaded', async () => {
    // ইউজার ইনফো লোড
    const { data: { user } } = await window.db.auth.getUser();
    if (!user) return window.location.href = 'login.html';

    document.getElementById('email').value = user.email;
    
    // ডাটাবেস থেকে বর্তমান প্রোফাইল লোড
    const { data: profile } = await window.db
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profile) {
        if (profile.full_name) document.getElementById('fullName').value = profile.full_name;
        if (profile.avatar_url) document.getElementById('avatarPreview').src = profile.avatar_url;
    }
});

// ছবি আপলোড ফাংশন
async function uploadAvatar() {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return;

    const { data: { user } } = await window.db.auth.getUser();
    
    // ফাইলের নাম ইউনিক করা (timestamp দিয়ে)
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    
    // বাটন লোডিং স্ট্যাটাস
    document.querySelector('.upload-btn').innerText = "⏳";

    // 1. Storage এ আপলোড
    const { data, error } = await window.db.storage
        .from('avatars')
        .upload(fileName, file);

    if (error) {
        alert("Upload failed: " + error.message);
        document.querySelector('.upload-btn').innerText = "📷";
    } else {
        // 2. পাবলিক URL পাওয়া
        const { data: { publicUrl } } = window.db.storage.from('avatars').getPublicUrl(fileName);
        
        // প্রিভিউ দেখানো
        document.getElementById('avatarPreview').src = publicUrl;
        document.querySelector('.upload-btn').innerText = "✅";
        
        // 3. ডাটাবেস আপডেট (অটোমেটিক)
        await updateProfile(publicUrl);
    }
}

// প্রোফাইল সেভ ফাংশন
async function updateProfile(avatarUrl = null) {
    const btn = document.getElementById('saveBtn');
    if(btn) btn.innerText = "Saving...";

    const { data: { user } } = await window.db.auth.getUser();
    const fullName = document.getElementById('fullName').value;
    
    // আপডেট অবজেক্ট তৈরি
    const updates = {
        id: user.id,
        full_name: fullName,
        updated_at: new Date()
    };
    
    // যদি ছবি আপলোড হয়ে থাকে, তবে URL আপডেট হবে
    if (avatarUrl && typeof avatarUrl === 'string') {
        updates.avatar_url = avatarUrl;
    }

    // Upsert (Insert or Update)
    const { error } = await window.db
        .from('profiles')
        .upsert(updates);

    if (error) {
        alert("Error: " + error.message);
    } else {
        if(!avatarUrl) alert("Profile updated successfully!"); // ছবি আপলোডের সময় অ্যালার্ট দরকার নেই
    }

    if(btn) btn.innerText = "Save Changes";
}