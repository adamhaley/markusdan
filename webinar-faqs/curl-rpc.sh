#! /bin/sh

curl -X POST "https://sbbaxnrkennoyqxcpxmq.supabase.co/rest/v1/rpc/match_faqs" \
  -H "apikey: sb_publishable_y_R1x1AwRDZWs8snjN_hWw_sLjcJBxs" \
  -H "Authorization: Bearer sb_publishable_y_R1x1AwRDZWs8snjN_hWw_sLjcJBxs" \
  -H "Content-Type: application/json" \
  -d '{
    "query_embedding": [-0.027200697, -0.0049381545, -0.0057860636, 0.039727732, 0.010456606],
    "match_count": 5
  }'
