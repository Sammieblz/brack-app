-- Public buckets can serve direct public URLs without allowing clients to list
-- every object through the Storage API.

DROP POLICY IF EXISTS "Avatar images are publicly accessible"
ON storage.objects;

DROP POLICY IF EXISTS "Users can view all book covers"
ON storage.objects;
